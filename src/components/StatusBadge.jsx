import React from 'react';
import clsx from 'clsx';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  const statusConfig = {
    pending: {
      label: 'في انتظار الموافقة',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: <Clock className="w-4 h-4 ml-1" />
    },
    approved: {
      label: 'تمت الموافقة',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: <CheckCircle2 className="w-4 h-4 ml-1" />
    },
    rejected: {
      label: 'مرفوض',
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: <XCircle className="w-4 h-4 ml-1" />
    }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={clsx(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium border',
      config.color
    )}>
      {config.icon}
      {config.label}
    </span>
  );
}
