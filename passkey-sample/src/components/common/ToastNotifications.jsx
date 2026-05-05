import { useEffect } from 'react';
import { Toast, ToastContainer, Button } from 'react-bootstrap';

const ToastItem = ({ toast, onClose }) => {
    useEffect(() => {
        if (toast.show && toast.autoHide !== false) {
            const timer = setTimeout(() => {
                onClose();
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [toast.show, toast.autoHide, onClose]);

    return (
        <Toast show={toast.show} onClose={onClose} className="mb-2">
            <Toast.Header closeButton={true} className="border-0">
                <strong className="me-auto">{toast.title}</strong>
            </Toast.Header>
            <Toast.Body className="text-muted">
                <div className="mb-2">{toast.message}</div>
                {toast.action && (
                    <div className="d-flex gap-2 mt-3">
                        <Button 
                            size="sm" 
                            variant={toast.action.variant || 'primary'}
                            onClick={() => {
                                toast.action.onClick();
                                onClose();
                            }}
                        >
                            {toast.action.label}
                        </Button>
                        <Button 
                            size="sm" 
                            variant="outline-secondary"
                            onClick={onClose}
                        >
                            Dismiss
                        </Button>
                    </div>
                )}
            </Toast.Body>
        </Toast>
    );
};

// Combined Toast Notifications Container
const ToastNotifications = ({ toasts, onCloseToast }) => {
    // Separate toasts by type for different positioning
    const sessionExpiredToasts = toasts.filter(toast => toast.type === 'sessionExpiredWithAction');
    const regularToasts = toasts.filter(toast => toast.type !== 'sessionExpiredWithAction');

    return (
        <>
            {/* Regular toasts - top-right corner */}
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
                {regularToasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        onClose={() => onCloseToast(toast.id)}
                    />
                ))}
            </ToastContainer>

            {/* Session expired toasts - center of screen */}
            {sessionExpiredToasts.length > 0 && (
                <div 
                    className="position-fixed w-100 h-100 d-flex justify-content-center align-items-center"
                    style={{ 
                        top: 0, 
                        left: 0, 
                        zIndex: 1055,
                        pointerEvents: 'none' // Allow clicks through the backdrop
                    }}
                >
                    <div style={{ pointerEvents: 'auto' }}>
                        {sessionExpiredToasts.map((toast) => (
                            <ToastItem
                                key={toast.id}
                                toast={toast}
                                onClose={() => onCloseToast(toast.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </>
    );
};

export default ToastNotifications;
