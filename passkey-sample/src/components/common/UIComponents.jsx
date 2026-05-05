import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * Security alert component for displaying informational messages with icons
 * @param {Object} props - Component props
 * @param {string} props.message - Alert message to display
 * @param {string} [props.type='info'] - Alert type (info, warning, danger, success)
 * @param {React.Component} [props.icon=FaExclamationTriangle] - Icon component to display
 * @returns {JSX.Element} Rendered security alert
 */
export const SecurityAlert = ({ message, type = 'info', icon: IconComponent = FaExclamationTriangle }) => {
    return (
        <div className="security-alert mb-4">
            <div className="d-flex align-items-center">
                <IconComponent className="me-2 security-alert-icon" />
                <span className="security-alert-text">{message}</span>
            </div>
        </div>
    );
};

/**
 * User profile header component displaying user information and description
 * @param {Object} props - Component props
 * @param {string} props.name - User's display name
 * @param {string} props.email - User's email address
 * @returns {JSX.Element} Rendered user profile header
 */
export const UserProfileHeader = ({ name, email }) => {
    return (
        <div className="user-profile-header mb-4">
            <div className="user-info mb-3">
                <h2 className="user-email mb-0 fw-semibold">{email}</h2>
            </div>
            <p className="user-description mb-0 text-muted">
                Manage sign-in and verification options for your account
            </p>
        </div>
    );
};
