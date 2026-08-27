export const formatCurrency = (amount, currency = 'UZS') => {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' ' + currency;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const getMonthName = (month) => MONTH_NAMES[(parseInt(month) - 1)] || '';

// ── Role badges ───────────────────────────────────────────────────────────────
export const getRoleBadge = (role) => {
  const map = {
    superadmin: { label: 'Super Admin', cls: 'badge-purple' },
    admin:      { label: 'Admin',       cls: 'badge-blue'   },
    teacher:    { label: 'Teacher',     cls: 'badge-green'  },
  };
  return map[role] || { label: role, cls: 'badge-gray' };
};

// ── Status badges (students, attendance, payments, leads) ─────────────────────
export const getStatusBadge = (status) => {
  const map = {
    // Student statuses
    active:   { label: 'Active',   cls: 'badge-green'  },
    frozen:   { label: 'Frozen',   cls: 'badge-blue'   },
    archived: { label: 'Archived', cls: 'badge-gray'   },
    inactive: { label: 'Inactive', cls: 'badge-red'    },
    // Attendance
    present:  { label: 'Present',  cls: 'badge-green'  },
    absent:   { label: 'Absent',   cls: 'badge-red'    },
    late:     { label: 'Late',     cls: 'badge-yellow' },
    // Payment
    paid:     { label: 'Paid',     cls: 'badge-green'  },
    unpaid:   { label: 'Unpaid',   cls: 'badge-red'    },
    partial:  { label: 'Partial',  cls: 'badge-yellow' },
    debtor:   { label: 'Debtor',   cls: 'badge-red'    },
    // Lead statuses
    new:         { label: 'New',         cls: 'badge-blue'   },
    contacted:   { label: 'Contacted',   cls: 'badge-yellow' },
    enrolled:    { label: 'Enrolled',    cls: 'badge-green'  },
    lost:        { label: 'Lost',        cls: 'badge-gray'   },
    // Group/course
    completed:   { label: 'Completed',   cls: 'badge-gray'   },
    in_progress: { label: 'In Progress', cls: 'badge-blue'   },
    upcoming:    { label: 'Upcoming',    cls: 'badge-yellow' },
    // Salary
    calculated:  { label: 'Calculated',  cls: 'badge-blue'   },
    approved:    { label: 'Approved',    cls: 'badge-green'  },
    pending:     { label: 'Pending',     cls: 'badge-yellow' },
  };
  return map[status] || { label: status, cls: 'badge-gray' };
};

/**
 * Convenience: render a badge span inline.
 * Returns a plain object { label, cls } — use with className spread.
 */
export const statusBadge  = (status) => getStatusBadge(status);
export const roleBadge    = (role)   => getRoleBadge(role);
