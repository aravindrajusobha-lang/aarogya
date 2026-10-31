import React from 'react';

export interface LoadingViewProps {
  message?: string;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ message = 'Loading data, please wait...' }) => {
  return (
    <div className="state-box state-loading" role="status" aria-live="polite">
      <div className="spinner" />
      <p style={{ fontSize: '0.9rem', color: 'var(--color-brand-accent)', fontWeight: 600 }}>{message}</p>
    </div>
  );
};

export interface EmptyViewProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyView: React.FC<EmptyViewProps> = ({
  title = 'No records found',
  description = 'No screening submissions exist in this local or remote queue.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="state-box state-empty">
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📂</div>
      <h4 style={{ fontWeight: 700, marginBottom: '6px' }}>{title}</h4>
      <p style={{ fontSize: '0.85rem', marginBottom: actionLabel ? '14px' : '0' }}>{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-secondary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export interface ErrorViewProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  title = 'Encountered an Error',
  message,
  onRetry,
}) => {
  return (
    <div className="state-box state-error" role="alert">
      <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>⚠️</div>
      <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>{title}</h4>
      <p style={{ fontSize: '0.85rem', marginBottom: onRetry ? '12px' : '0' }}>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry} style={{ marginTop: '8px' }}>
          Retry Request
        </button>
      )}
    </div>
  );
};

export interface SuccessViewProps {
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  title = 'Action Successful',
  message,
  onDismiss,
}) => {
  return (
    <div className="state-box state-success">
      <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>✅</div>
      <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>{title}</h4>
      <p style={{ fontSize: '0.85rem' }}>{message}</p>
      {onDismiss && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onDismiss}
          style={{ marginTop: '10px', fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
};
