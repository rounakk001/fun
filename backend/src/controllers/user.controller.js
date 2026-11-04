import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import { Subscription } from "../models/subscription.model.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


//asyncHandler is used when time is taken by web to fulfill request and async is used when time is taken by local methods to fulfill request
//the userId here is the same id that mongodb gives to each user in the table
const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        //get user
        const user = await User.findById(userId)
        //generate accessToken and refreshToken
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        //save in db
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        ///return
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

//register the user
const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    //can write more validation checks
    //validating user fields
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    //checking if user is present or not
    const existedUser = await User.findOne({
        //Or is used here to check between username and email if amy if them is already present, give error
        $or: [{ username }, { email }]
    })
    //if user is already present we throw error through ApiError
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //getting local image path of both avatar and cover image from multer to upload on cloudinary
    const avatarLocalPath = req.files?.avatar[0]?.path; //avatar[0] is used because it provides the path(optionally) that multer has uploaded  
    //const coverImag eLocalPath = req.files?.coverImage[0]?.path;

    //includes check for req.files has anything or not otherwise retriveing url later on is problematic
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    //Check if avatar file is there or not because it is mandatory
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   
    //create user in database
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        //check if coverimage is actually there or not
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    //check if user is actually created or not
    //also with chaining and using select method with can omit password and refreshtoken here itself
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //return error message if user is not created
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //return the final response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

//login the user
const loginUser = asyncHandler(async (req, res) =>{
    // req body -> data 
    // username or email
    // find the user
    // password check
    // access and referesh token
    // send cookie

    //get user credentials -> username and email
    const {email, username, password} = req.body

    //check no username or email is entered
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

    //check if present in db or not
    const user = await User.findOne({
        $or: [{username}, {email}]
    }).select("+password")

    //if user is not present
    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    //check for correct password
    //also when using methods of mongoose we use "User" and when using self made methods like passwordcheck we use "user"
   const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    //generating accessToken and refreshToken for user
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    //removing password and refreshToken from the user field for security purpose 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //sending cookie
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

//logout the user
const logoutUser = asyncHandler(async(req, res) => {
    // If user is authenticated, unset refreshToken in DB
    if (req.user?._id) {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $unset: {
                    refreshToken: 1 // this removes the field from document
                }
            }, 
            {
                returnDocument: 'after'
            }
        )
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})

//refresh AcessToken of user 
const refreshAccessToken = asyncHandler(async (req, res) => {
    //store the refresh token to compare 
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }
    
    //decode the refresh token
    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        
        //get user details through the id field of refresh token
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
            
        }
    
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
        }
    
        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

//changing current password
const changeCurrentPassword = asyncHandler(async(req, res) => {
    //not authorizing here because we will use middleware to do so 
    const {oldPassword, newPassword} = req.body
    //get user through authmiddleware
    const user = await User.findById(req.user?._id)
    //check for correct old password
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    //save newPassword to the user
    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"))
})

//get current user
const getCurrentUser = asyncHandler(async(req, res) => {
    //we can fetch current user from req.user which was in authmiddleware
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User fetched successfully"
    ))
})

//update Account details
const updateAccountDetails = asyncHandler(async(req, res) => {
    //get the fullName and email from user which is to be updated
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        //this field is set true to return the updated reponse
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});

//update Avatar
const updateUserAvatar = asyncHandler(async(req, res) => {
    //get the new avatar
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    //TODO: delete old image - assignment

    //upload on cloudinary and get the url
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    //if no url is found, give apiError
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    //UPDATE the avatar
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar image updated successfully")
    )
})

//update cover image
const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }

    //TODO: delete old image - assignment


    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
        
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover image updated successfully")
    )
})

//get user channel profile
const getUserChannelProfile = asyncHandler(async(req, res) => {
    //get username from  
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    //write aggregation pipelines
    const channel = await User.aggregate([
        {   
            //since this is kind of joins, so we have to match the usernames that we are getting from the different tables
            $match: {
                username: username?.toLowerCase()
            }
        },
        {   
            //get count of subscribers
            //since we got the username -> user now we are looking for its subscribers, this also integrates the concept of joins 
            $lookup: {
                //kaha se detail udha rhey
                from: "subscriptions",
                //same id that is stored in user table(can say)
                localField: "_id",
                //subscription model me kise lookup kr rhey vo wali field, since subscribers count krne ke liye channel field dekhte they
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            //getting count of how many user have subscribed
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            //getting actual counts here
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                //this is a additional field that gives a true false indication to the frontend that user is subs or not 
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            //this pipeline is used to show details of user(selective only)
            $project: {
                _id: 1,
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if (req.user?._id) {
    await Subscription.findOneAndUpdate(
        { subscriber: req.user._id, channel: channel[0]._id },
        { $set: { lastViewedAt: new Date() } }
        )
    }

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

//get watch history
const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                //here direct req.user.id will not work because agrr pipeline code is directly sent as it(which is typically a string) is so will have to convert it to id form
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            //user(watchHistory) -> videos(owner) -> user(_id)
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}