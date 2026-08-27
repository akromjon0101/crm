import React from 'react';
import Modal from './Modal';

const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmText = 'Delete', variant = 'danger', loading }) => (
  <Modal open={open} onClose={onClose} title={title} size="sm">
    <p className="text-sm text-gray-600 dark:text-slate-300">{message}</p>
    <div className="flex justify-end gap-3 mt-6">
      <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
      <button
        className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
        onClick={onConfirm}
        disabled={loading}
      >
        {loading ? 'Processing...' : confirmText}
      </button>
    </div>
  </Modal>
);

export default ConfirmDialog;
