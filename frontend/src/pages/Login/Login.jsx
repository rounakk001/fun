import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/ui/Spinner';
import './Login.css';

/**
 * Validation rules:
 *  - identifier (email or username): required
 *  - password: required, min 6 chars
 *
 * Backend accepts either email or username in the same field,
 * so we send both — the non-matching one will just be an empty string.
 * To keep the UX simple we use a single "Email or Username" field and
 * determine which it is by checking for '@'.
 */

const INITIAL_FIELDS = { identifier: '', password: '' };
const INITIAL_ERRORS = { identifier: '', password: '', form: '' };

function validate(fields) {
  const errors = { identifier: '', password: '', form: '' };

  if (!fields.identifier.trim()) {
    errors.identifier = 'Email or username is required.';
  }

  if (!fields.password) {
    errors.password = 'Password is required.';
  } else if (fields.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return errors;
}

function hasErrors(errors) {
  return Object.values(errors).some((msg) => msg !== '');
}

function Login() {
  const { login } = useAuth();
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [errors, setErrors] = useState(INITIAL_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
    // Clear the field-level error as the user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate(fields);
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors(INITIAL_ERRORS);

    // Detect if the identifier looks like an email
    const isEmail = fields.identifier.includes('@');
    const credentials = isEmail
      ? { email: fields.identifier, password: fields.password }
      : { username: fields.identifier, password: fields.password };

    try {
      await login(credentials);
      // login() in AuthContext handles navigation on success
    } catch (err) {
      const message =
        err.response?.data?.message || 'Something went wrong. Please try again.';
      setErrors((prev) => ({ ...prev, form: message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Decorative background glow */}
      <div className="auth-glow auth-glow--left" aria-hidden="true" />
      <div className="auth-glow auth-glow--right" aria-hidden="true" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo__mark">Y</span>
          <span className="auth-logo__word">eonix</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your account to continue</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {/* Form-level error (from backend) */}
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

          {/* Identifier */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-identifier">
              Email or Username
            </label>
            <input
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              className={`form-input${errors.identifier ? ' has-error' : ''}`}
              placeholder="you@example.com or @username"
              value={fields.identifier}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.identifier && (
              <span className="form-error" role="alert">
                {errors.identifier}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className={`form-input${errors.password ? ' has-error' : ''}`}
              placeholder="••••••••"
              value={fields.password}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.password && (
              <span className="form-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="auth-redirect">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="auth-redirect__link">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
