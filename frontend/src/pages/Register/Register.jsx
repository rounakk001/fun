import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/ui/Spinner';
import '../Login/Login.css';  /* re-use shared auth page styles */
import './Register.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INITIAL_FIELDS = {
  fullName: '',
  username: '',
  email: '',
  password: '',
};
const INITIAL_ERRORS = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  avatar: '',
  form: '',
};

function validate(fields, avatarFile) {
  const errors = { ...INITIAL_ERRORS };

  if (!fields.fullName.trim()) errors.fullName = 'Full name is required.';

  if (!fields.username.trim()) {
    errors.username = 'Username is required.';
  } else if (/\s/.test(fields.username)) {
    errors.username = 'Username cannot contain spaces.';
  }

  if (!fields.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_REGEX.test(fields.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!fields.password) {
    errors.password = 'Password is required.';
  } else if (fields.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (!avatarFile) {
    errors.avatar = 'A profile picture is required.';
  }

  return errors;
}

function hasErrors(errors) {
  return Object.values(errors).some((msg) => msg !== '');
}

function Register() {
  const { register } = useAuth();
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File state — stored separately since they don't live in form fields
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImageName, setCoverImageName] = useState('');

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setErrors((prev) => ({ ...prev, avatar: '' }));
    // Generate a local preview URL
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImageFile(file);
    setCoverImageName(file.name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate(fields, avatarFile);
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors(INITIAL_ERRORS);

    // Build FormData — backend expects multipart/form-data
    const formData = new FormData();
    formData.append('fullName', fields.fullName.trim());
    formData.append('username', fields.username.trim().toLowerCase());
    formData.append('email', fields.email.trim());
    formData.append('password', fields.password);
    formData.append('avatar', avatarFile);
    if (coverImageFile) {
      formData.append('coverImage', coverImageFile);
    }

    try {
      await register(formData);
      // register() in AuthContext navigates to /login on success
    } catch (err) {
      // Log full error so you can inspect it in DevTools Console > Network/Console
      console.error('[Register] Error:', err);
      console.error('[Register] Response data:', err.response?.data);
      console.error('[Register] Status:', err.response?.status);

      let message;
      if (!err.response) {
        // Network error — backend not reachable or CORS preflight blocked
        message = `Network error: Cannot reach the server. Make sure the backend is running on port 8000 and CORS_ORIGIN is set to http://localhost:5173.`;
      } else {
        // Backend returned an error response — use its message
        message = err.response.data?.message || `Server error (${err.response.status}). Please try again.`;
      }
      setErrors((prev) => ({ ...prev, form: message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow--left" aria-hidden="true" />
      <div className="auth-glow auth-glow--right" aria-hidden="true" />

      <div className="auth-card auth-card--wide">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo__mark">Y</span>
          <span className="auth-logo__word">eonix</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join Yeonix and start sharing your world</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {errors.form && (
            <div className="auth-form-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11" r="0.75" fill="currentColor" />
              </svg>
              {errors.form}
            </div>
          )}

          {/* Two-column row for full name + username */}
          <div className="register-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-fullName">
                Full Name
              </label>
              <input
                id="reg-fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                className={`form-input${errors.fullName ? ' has-error' : ''}`}
                placeholder="Jane Doe"
                value={fields.fullName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.fullName && (
                <span className="form-error" role="alert">{errors.fullName}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-username">
                Username
              </label>
              <input
                id="reg-username"
                name="username"
                type="text"
                autoComplete="username"
                className={`form-input${errors.username ? ' has-error' : ''}`}
                placeholder="janedoe"
                value={fields.username}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.username && (
                <span className="form-error" role="alert">{errors.username}</span>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              className={`form-input${errors.email ? ' has-error' : ''}`}
              placeholder="you@example.com"
              value={fields.email}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.email && (
              <span className="form-error" role="alert">{errors.email}</span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">
              Password
            </label>
            <input
              id="reg-password"
              name="password"
              type="password"
              autoComplete="new-password"
              className={`form-input${errors.password ? ' has-error' : ''}`}
              placeholder="At least 6 characters"
              value={fields.password}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.password && (
              <span className="form-error" role="alert">{errors.password}</span>
            )}
          </div>

          {/* Avatar (required) */}
          <div className="form-group">
            <label className="form-label">
              Profile Picture <span className="register-required">*</span>
            </label>
            {/* Hidden native input */}
            <input
              ref={avatarInputRef}
              id="reg-avatar"
              name="avatar"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
              disabled={isSubmitting}
            />
            {/* Custom styled label acting as a button */}
            <label
              htmlFor="reg-avatar"
              className={`file-upload-label${avatarFile ? ' has-file' : ''}${errors.avatar ? ' has-error' : ''}`}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="file-upload-preview" />
              ) : (
                <span className="file-upload-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                </span>
              )}
              <span className="file-upload-name">
                {avatarFile ? avatarFile.name : 'Choose a profile picture…'}
              </span>
            </label>
            {errors.avatar && (
              <span className="form-error" role="alert">{errors.avatar}</span>
            )}
          </div>

          {/* Cover Image (optional) */}
          <div className="form-group">
            <label className="form-label">
              Cover Image <span className="register-optional">(optional)</span>
            </label>
            <input
              ref={coverInputRef}
              id="reg-coverImage"
              name="coverImage"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleCoverChange}
              disabled={isSubmitting}
            />
            <label
              htmlFor="reg-coverImage"
              className={`file-upload-label${coverImageFile ? ' has-file' : ''}`}
            >
              <span className="file-upload-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="8.5" cy="10.5" r="1.5" />
                  <path d="m21 15-5-5L5 19" />
                </svg>
              </span>
              <span className="file-upload-name">
                {coverImageName || 'Choose a cover image…'}
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            id="register-submit-btn"
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" />
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p className="auth-redirect">
          Already have an account?{' '}
          <Link to="/login" className="auth-redirect__link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
