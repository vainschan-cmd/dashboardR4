'use client';

import dynamic from 'next/dynamic';
import ModuleSkeleton from './ModuleSkeleton';

/**
 * Code-split registry of every dashboard module (`CODE-02`).
 *
 * The `dynamic()` calls used to sit at the top of `page.tsx`, where they made a
 * 1,100-line file start with 250 lines of import plumbing. Keeping them in one
 * place means the split points can be reviewed as a list, and the shell no
 * longer needs to know each component's path.
 */

const loading = () => <ModuleSkeleton />;

export const PortSightBeranda = dynamic(() => import('@/components/portsight/PortSightBeranda'), { loading });
export const PortSightPeriode = dynamic(() => import('@/components/portsight/PortSightPeriode'), { loading });
export const PortSightKeuangan = dynamic(() => import('@/components/portsight/PortSightKeuangan'), { loading });
export const PortSightOpkom = dynamic(() => import('@/components/portsight/PortSightOpkom'), { loading });
export const PortSightKinerja = dynamic(() => import('@/components/portsight/PortSightKinerja'), { loading });
export const PortSightUtilisasi = dynamic(() => import('@/components/portsight/PortSightUtilisasi'), { loading });
export const PortSightPeralatan = dynamic(() => import('@/components/portsight/PortSightPeralatan'), { loading });
export const PortSightFasilitas = dynamic(() => import('@/components/portsight/PortSightFasilitas'), { loading });

export const DataRecordsView = dynamic(() => import('@/components/admin/DataRecordsView'), { loading });
export const MasterDataView = dynamic(() => import('@/components/admin/MasterDataView'), { loading });
export const VerificationQueue = dynamic(() => import('@/components/admin/VerificationQueue'), { loading });
export const ImportCenter = dynamic(() => import('@/components/admin/ImportCenter'), { loading });
export const TemplateMapping = dynamic(() => import('@/components/admin/TemplateMapping'), { loading });
export const AuditTrailView = dynamic(() => import('@/components/admin/AuditTrailView'), { loading });

export const ManualDataInputModal = dynamic(() => import('@/components/admin/ManualDataInputModal'));
export const ComparisonModal = dynamic(() => import('@/components/modals/ComparisonModal'));
export const AuthModal = dynamic(() => import('@/components/auth/AuthModal'));
export const PasswordChangeModal = dynamic(() => import('@/components/auth/PasswordChangeModal'));
