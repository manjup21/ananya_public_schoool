import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  IndianRupee,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  TrendingUp,
  Users,
  AlertCircle,
  Plus,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerInput } from '../components/common/DatePickerInput';
import { FormSelect } from '../components/common/FormSelect';
import { TablePagination } from '../components/common/TablePagination';
import { TableEmptyRow } from '../components/common/TableEmptyRow';
import { SearchInput } from '../components/common/SearchInput';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';
import { Skeleton } from '../components/ui/skeleton';
import { Spinner } from '../components/ui/spinner';
import { Checkbox } from '../components/ui/checkbox';
import { TableSkeletonRows } from '../components/common/TableSkeletonRows';
import { useClasses } from '../features/classes/useClasses';
import {
  fetchStudentFeesThunk,
  fetchStudentFeeDetailThunk,
  fetchFeeDashboardThunk,
  assignFeeThunk,
  bulkAssignFeeThunk,
  recordPaymentThunk,
  deletePaymentThunk,
  deleteFeeItemThunk,
  clearDetail,
} from '../features/fees/feesSlice';
import { exportFeeStatementPdf, exportPaymentReceiptPdf } from '../utils/feeStatementPdf';
import { toIsoDate } from '../utils/dateOnly';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

function currentAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return m >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function fmtCurrency(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}-${m}-${y}`;
}

function feeStatusBadge(net, paid) {
  const n = Number(net) || 0;
  const p = Number(paid) || 0;
  if (n <= 0) return { className: 'bg-gray-100 text-gray-600', label: 'No fee' };
  if (p >= n) return { className: 'bg-green-50 text-green-700', label: 'Paid' };
  if (p > 0) return { className: 'bg-amber-50 text-amber-800', label: 'Partial' };
  return { className: 'bg-red-50 text-red-700', label: 'Unpaid' };
}

const emptyAssignForm = () => ({
  studentId: '',
  academicYear: currentAcademicYear(),
  feeName: '',
  totalFee: '',
  discount: '',
  dueDate: null,
  notes: '',
  addToExisting: false,
});

const emptyBulkForm = () => ({
  classId: '',
  sectionId: '',
  feeName: '',
  totalFee: '',
  discount: '',
  dueDate: null,
  notes: '',
  addToExisting: false,
});

function isDanger(dueDate, netFee, totalPaid) {
  if (!dueDate || netFee == null) return false;
  const due = new Date(String(dueDate).slice(0, 10) + 'T00:00:00');
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + 30);
  return due <= threshold && (Number(totalPaid) || 0) < (Number(netFee) || 0);
}

const emptyPaymentForm = () => ({
  studentFeeId: '',
  amount: '',
  paymentDate: new Date(),
  paymentMethod: '',
  referenceNumber: '',
  receiptNumber: '',
  notes: '',
});

export function FeeManagement() {
  const dispatch = useDispatch();

  const { classes } = useClasses();

  const feeList = useSelector((s) => s.fees.list);
  const listStatus = useSelector((s) => s.fees.listStatus);
  const listError = useSelector((s) => s.fees.listError);

  const feeDetail = useSelector((s) => s.fees.detail);
  const detailStatus = useSelector((s) => s.fees.detailStatus);

  const dashboard = useSelector((s) => s.fees.dashboard);
  const dashboardStatus = useSelector((s) => s.fees.dashboardStatus);

  const academicYear = currentAcademicYear();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [paymentStudentName, setPaymentStudentName] = useState('');

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState(null);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(emptyBulkForm);

  const [deletingPaymentId, setDeletingPaymentId] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignFeeItems, setAssignFeeItems] = useState([]);
  const [assignPayments, setAssignPayments] = useState([]);
  const [assignItemsLoading, setAssignItemsLoading] = useState(false);
  const [deletingFeeItemId, setDeletingFeeItemId] = useState(null);
  const [isDeleteFeeItemOpen, setIsDeleteFeeItemOpen] = useState(false);
  const [isBulkReplaceWarnOpen, setIsBulkReplaceWarnOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [downloadStudent, setDownloadStudent] = useState(null);
  const [downloadFee, setDownloadFee] = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(null); // 'full' | paymentId

  const loadList = useCallback(() => {
    if (!academicYear) return;
    dispatch(fetchStudentFeesThunk({
      academicYear,
      search: searchQuery.trim() || undefined,
      classId: filterClassId || undefined,
      sectionId: filterSectionId || undefined,
      page,
      limit: pageSize,
    }));
  }, [dispatch, academicYear, searchQuery, filterClassId, filterSectionId, page, pageSize]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (academicYear) {
      dispatch(fetchFeeDashboardThunk({ academicYear }));
    }
  }, [dispatch, academicYear]);

  useEffect(() => { setPage(1); }, [searchQuery, filterClassId, filterSectionId, pageSize]);

  useEffect(() => { setFilterSectionId(''); }, [filterClassId]);

  const sectionOptions = useMemo(() => {
    if (!filterClassId) return [];
    const cls = classes.find((c) => c.id === filterClassId);
    return (cls?.sections || []).map((s) => ({ value: s.id, label: s.section }));
  }, [classes, filterClassId]);

  const students = feeList?.students ?? [];
  const totalCount = feeList?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // --- Assign Fee ---
  const updateAssign = (patch) => setAssignForm((p) => ({ ...p, ...patch }));

  const openAssignForStudent = async (student) => {
    const dueDateStr = student.due_date ? String(student.due_date).slice(0, 10) : '';
    setAssignForm({
      studentId: student.student_id,
      academicYear,
      feeName: '',
      totalFee: student.total_fee != null ? String(student.total_fee) : '',
      discount: student.discount != null ? String(student.discount) : '0',
      dueDate: dueDateStr ? new Date(`${dueDateStr}T00:00:00`) : null,
      notes: '',
      addToExisting: false,
    });
    setAssignFeeItems([]);
    setAssignPayments([]);
    setIsAssignOpen(true);

    if (student.fee_id && student.student_id) {
      setAssignItemsLoading(true);
      try {
        const detail = await dispatch(
          fetchStudentFeeDetailThunk({ studentId: student.student_id, academicYear })
        ).unwrap();
        const fee = detail?.fees?.[0];
        setAssignFeeItems(Array.isArray(fee?.fee_items) ? fee.fee_items : []);
        setAssignPayments(Array.isArray(fee?.payments) ? fee.payments : []);
      } catch {
        setAssignFeeItems([]);
        setAssignPayments([]);
      } finally {
        setAssignItemsLoading(false);
      }
    }
  };

  const handleAssignSubmit = async () => {
    if (!assignForm.studentId) { toast.error('Select a student'); return; }
    if (!assignForm.academicYear?.trim()) { toast.error('Academic year is required'); return; }
    if (!assignForm.feeName?.trim()) { toast.error('Fee name is required'); return; }
    if (assignForm.feeName.trim().length > 120) { toast.error('Fee name must be <= 120 characters'); return; }
    const total = Number(assignForm.totalFee);
    if (!Number.isFinite(total) || total < 0) { toast.error('Total fee must be a number >= 0'); return; }
    const disc = Number(assignForm.discount || 0);
    if (!Number.isFinite(disc) || disc < 0) { toast.error('Discount must be >= 0'); return; }
    if (disc > total) { toast.error('Discount cannot exceed total fee'); return; }

    setSaving(true);
    try {
      await dispatch(assignFeeThunk({
        student_id: assignForm.studentId,
        academic_year: assignForm.academicYear.trim(),
        total_fee: total,
        discount: disc,
        due_date: toIsoDate(assignForm.dueDate) || null,
        notes: assignForm.notes.trim() || null,
        add_to_existing: Boolean(assignForm.addToExisting),
        fee_name: assignForm.feeName.trim(),
      })).unwrap();
      toast.success(assignForm.addToExisting ? 'Fee added successfully' : 'Fee assigned successfully');
      setIsAssignOpen(false);
      setAssignForm(emptyAssignForm());
      loadList();
      dispatch(fetchFeeDashboardThunk({ academicYear }));
    } catch (e) {
      toast.error(String(e || 'Failed to assign fee'));
    } finally {
      setSaving(false);
    }
  };

  // --- Record Payment ---
  const updatePayment = (patch) => setPaymentForm((p) => ({ ...p, ...patch }));

  const openRecordPayment = (student) => {
    if (!student.fee_id) {
      toast.error('Assign a fee first before recording payments');
      return;
    }
    setPaymentForm({
      ...emptyPaymentForm(),
      studentFeeId: student.fee_id,
    });
    const name = [student.first_name, student.last_name].filter(Boolean).join(' ');
    setPaymentStudentName(`${name} (${student.roll_number})`);
    setIsPaymentOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!paymentForm.studentFeeId) { toast.error('Fee record missing'); return; }
    const amt = Number(paymentForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Amount must be > 0'); return; }
    if (!paymentForm.paymentDate) { toast.error('Payment date is required'); return; }
    if (!paymentForm.paymentMethod) { toast.error('Payment method is required'); return; }

    setSaving(true);
    try {
      await dispatch(recordPaymentThunk({
        student_fee_id: paymentForm.studentFeeId,
        amount: amt,
        payment_date: toIsoDate(paymentForm.paymentDate),
        payment_method: paymentForm.paymentMethod,
        reference_number: paymentForm.referenceNumber.trim() || null,
        receipt_number: paymentForm.receiptNumber.trim() || null,
        notes: paymentForm.notes.trim() || null,
      })).unwrap();
      toast.success('Payment recorded');
      setIsPaymentOpen(false);
      setPaymentForm(emptyPaymentForm());
      loadList();
      dispatch(fetchFeeDashboardThunk({ academicYear }));
      if (detailStudentId) {
        dispatch(fetchStudentFeeDetailThunk({ studentId: detailStudentId, academicYear }));
      }
    } catch (e) {
      toast.error(String(e || 'Failed to record payment'));
    } finally {
      setSaving(false);
    }
  };

  // --- View Detail ---
  const openDetail = (studentId) => {
    setDetailStudentId(studentId);
    dispatch(fetchStudentFeeDetailThunk({ studentId, academicYear }));
    setIsDetailOpen(true);
  };

  const openDownloadOptions = async (student) => {
    if (!student?.fee_id || !student?.student_id) {
      toast.error('Assign a fee first');
      return;
    }
    setDownloadStudent(student);
    setDownloadFee(null);
    setIsDownloadOpen(true);
    setDownloadLoading(true);
    try {
      const detail = await dispatch(
        fetchStudentFeeDetailThunk({ studentId: student.student_id, academicYear })
      ).unwrap();
      const fee = detail?.fees?.[0];
      if (!fee) {
        toast.error('Fee record not found');
        setIsDownloadOpen(false);
        setDownloadStudent(null);
        return;
      }
      setDownloadFee(fee);
    } catch (e) {
      toast.error(String(e || 'Failed to load fee details'));
      setIsDownloadOpen(false);
      setDownloadStudent(null);
    } finally {
      setDownloadLoading(false);
    }
  };

  const closeDownloadOptions = () => {
    if (downloadBusy) return;
    setIsDownloadOpen(false);
    setDownloadStudent(null);
    setDownloadFee(null);
    setDownloadBusy(null);
  };

  const handleDownloadFullRecord = async () => {
    if (!downloadStudent || !downloadFee) return;
    setDownloadBusy('full');
    try {
      await exportFeeStatementPdf({
        student: downloadStudent,
        fee: downloadFee,
        academicYear,
      });
      toast.success('Complete fee record downloaded');
    } catch (e) {
      toast.error(String(e || 'Failed to download fee record'));
    } finally {
      setDownloadBusy(null);
    }
  };

  const handleDownloadPaymentReceipt = async (payment) => {
    if (!downloadStudent || !downloadFee || !payment?.id) return;
    setDownloadBusy(payment.id);
    try {
      await exportPaymentReceiptPdf({
        student: downloadStudent,
        fee: downloadFee,
        payment,
        academicYear,
      });
      toast.success('Payment receipt downloaded');
    } catch (e) {
      toast.error(String(e || 'Failed to download payment receipt'));
    } finally {
      setDownloadBusy(null);
    }
  };

  const downloadPayments = useMemo(() => {
    const raw = Array.isArray(downloadFee?.payments) ? [...downloadFee.payments] : [];
    return raw.sort((a, b) => {
      const da = String(a.payment_date ?? '').slice(0, 10);
      const db = String(b.payment_date ?? '').slice(0, 10);
      if (da !== db) return db.localeCompare(da);
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
    });
  }, [downloadFee]);

  const closeDetail = () => {
    setIsDetailOpen(false);
    setDetailStudentId(null);
    dispatch(clearDetail());
  };

  // --- Delete Payment ---
  const openDeletePayment = (paymentId) => {
    setDeletingPaymentId(paymentId);
    setIsDeleteOpen(true);
  };

  const handleDeletePayment = async () => {
    if (!deletingPaymentId) return;
    const removedId = deletingPaymentId;
    try {
      await dispatch(deletePaymentThunk(removedId)).unwrap();
      toast.success('Payment deleted');
      setIsDeleteOpen(false);
      setDeletingPaymentId(null);
      setAssignPayments((prev) => prev.filter((p) => p.id !== removedId));
      loadList();
      dispatch(fetchFeeDashboardThunk({ academicYear }));
      if (detailStudentId) {
        dispatch(fetchStudentFeeDetailThunk({ studentId: detailStudentId, academicYear }));
      }
    } catch (e) {
      toast.error(String(e || 'Failed to delete payment'));
    }
  };

  // --- Bulk Assign ---
  const updateBulk = (patch) => setBulkForm((p) => ({ ...p, ...patch }));

  const bulkSectionOptions = useMemo(() => {
    if (!bulkForm.classId) return [];
    const cls = classes.find((c) => c.id === bulkForm.classId);
    return (cls?.sections || []).map((s) => ({ value: s.id, label: s.section }));
  }, [classes, bulkForm.classId]);

  const handleBulkSubmit = async () => {
    if (!bulkForm.classId) { toast.error('Select a class'); return; }
    if (!bulkForm.feeName?.trim()) { toast.error('Fee name is required'); return; }
    if (bulkForm.feeName.trim().length > 120) { toast.error('Fee name must be <= 120 characters'); return; }
    const total = Number(bulkForm.totalFee);
    if (!Number.isFinite(total) || total < 0) { toast.error('Total fee must be a number >= 0'); return; }
    const disc = Number(bulkForm.discount || 0);
    if (!Number.isFinite(disc) || disc < 0) { toast.error('Discount must be >= 0'); return; }
    if (disc > total) { toast.error('Discount cannot exceed total fee'); return; }

    // Replace mode can wipe existing named fee types — warn before continuing
    if (!bulkForm.addToExisting) {
      setIsBulkReplaceWarnOpen(true);
      return;
    }

    await runBulkAssign();
  };

  const runBulkAssign = async () => {
    const total = Number(bulkForm.totalFee);
    const disc = Number(bulkForm.discount || 0);

    setSaving(true);
    try {
      const result = await dispatch(bulkAssignFeeThunk({
        class_id: bulkForm.classId,
        section_id: bulkForm.sectionId || null,
        academic_year: academicYear,
        total_fee: total,
        discount: disc,
        due_date: toIsoDate(bulkForm.dueDate) || null,
        notes: bulkForm.notes.trim() || null,
        add_to_existing: Boolean(bulkForm.addToExisting),
        fee_name: bulkForm.feeName.trim(),
      })).unwrap();
      const actionWord = bulkForm.addToExisting ? 'Added for' : 'Assigned to';
      const msg = `${actionWord} ${result.assigned} student${result.assigned !== 1 ? 's' : ''}` +
        (result.skipped > 0 ? `, skipped ${result.skipped} (already paid more)` : '');
      toast.success(msg);
      setIsBulkReplaceWarnOpen(false);
      setIsBulkOpen(false);
      setBulkForm(emptyBulkForm());
      loadList();
      dispatch(fetchFeeDashboardThunk({ academicYear }));
    } catch (e) {
      toast.error(String(e || 'Failed to bulk assign'));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteFeeItem = (itemId) => {
    setDeletingFeeItemId(itemId);
    setIsDeleteFeeItemOpen(true);
  };

  const handleDeleteFeeItem = async () => {
    if (!deletingFeeItemId) return;
    try {
      await dispatch(deleteFeeItemThunk(deletingFeeItemId)).unwrap();
      toast.success('Fee type deleted');
      setIsDeleteFeeItemOpen(false);
      setDeletingFeeItemId(null);
      setAssignFeeItems((prev) => prev.filter((i) => i.id !== deletingFeeItemId));
      loadList();
      dispatch(fetchFeeDashboardThunk({ academicYear }));
      if (detailStudentId) {
        dispatch(fetchStudentFeeDetailThunk({ studentId: detailStudentId, academicYear }));
      }
      if (assignForm.studentId) {
        try {
          const detail = await dispatch(
            fetchStudentFeeDetailThunk({ studentId: assignForm.studentId, academicYear })
          ).unwrap();
          const fee = detail?.fees?.[0];
          setAssignFeeItems(Array.isArray(fee?.fee_items) ? fee.fee_items : []);
          if (fee) {
            updateAssign({
              totalFee: fee.total_fee != null ? String(fee.total_fee) : '',
              discount: fee.discount != null ? String(fee.discount) : '0',
            });
          }
        } catch {
          /* keep local list */
        }
      }
    } catch (e) {
      toast.error(String(e || 'Failed to delete fee type'));
    }
  };

  const detailFee = feeDetail?.fees?.[0] ?? null;
  const detailPayments = detailFee?.payments ?? [];
  const detailFeeItems = Array.isArray(detailFee?.fee_items) ? detailFee.fee_items : [];
  const deletingFeeItem = assignFeeItems.find((i) => i.id === deletingFeeItemId)
    || detailFeeItems.find((i) => i.id === deletingFeeItemId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Management"        actions={
          <Button className="gap-2 w-full sm:w-auto" type="button" onClick={() => { setBulkForm(emptyBulkForm()); setIsBulkOpen(true); }}>
            <Plus className="h-4 w-4" />
            Bulk Assign Fee
          </Button>
        }
      />

      {/* Dashboard Summary */}
      {dashboardStatus === 'loading' || dashboardStatus === 'idle' ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboardStatus === 'succeeded' && dashboard ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <IndianRupee className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Expected</p>
                  <p className="text-lg font-semibold text-gray-900">{fmtCurrency(dashboard.total_expected)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Collected</p>
                  <p className="text-lg font-semibold text-green-700">{fmtCurrency(dashboard.total_collected)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="text-lg font-semibold text-red-700">{fmtCurrency(dashboard.total_outstanding)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Collection Rate</p>
                  <p className="text-lg font-semibold text-gray-900">{dashboard.collection_rate ?? 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Students &amp; Fees</CardTitle>
            <div className="text-sm text-gray-600">
              Total: <span className="font-medium text-gray-900">{totalCount}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {listStatus === 'failed' ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {listError || 'Failed to load fees'}
            </div>
          ) : null}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-48">
              <FormSelect
                id="fee-class-filter"
                label="Class"
                value={filterClassId}
                onValueChange={setFilterClassId}
                placeholder="All Classes"
                options={[{ value: '', label: 'All Classes' }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
            {sectionOptions.length > 0 ? (
              <div className="w-full sm:w-40">
                <FormSelect
                  id="fee-section-filter"
                  label="Section"
                  value={filterSectionId}
                  onValueChange={setFilterSectionId}
                  placeholder="All Sections"
                  options={[{ value: '', label: 'All Sections' }, ...sectionOptions]}
                />
              </div>
            ) : null}
            <div className="flex-1">
              <Label htmlFor="fee-search" className="sr-only">Search</Label>
              <SearchInput
                id="fee-search"
                placeholder="Search by name or roll number..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Roll No</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="text-right">Net Fee</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listStatus === 'loading' ? (
                    <TableSkeletonRows columns={9} rows={5} />
                  ) : students.length === 0 ? (
                    <TableEmptyRow colSpan={9}>No students found</TableEmptyRow>
                  ) : (
                    students.map((s) => {
                      const sb = feeStatusBadge(s.net_fee, s.total_paid);
                      const name = [s.first_name, s.last_name].filter(Boolean).join(' ');
                      const danger = isDanger(s.due_date, s.net_fee, s.total_paid);
                      return (
                        <TableRow key={s.student_id} className={danger ? 'bg-red-50/50' : ''}>
                          <TableCell className="font-medium">{s.roll_number}</TableCell>
                          <TableCell className="text-gray-700">{name}</TableCell>
                          <TableCell className="text-gray-600">
                            {s.class_name}{s.section_code ? ` - ${s.section_code}` : ''}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {s.net_fee != null ? fmtCurrency(s.net_fee) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-green-700">
                            {fmtCurrency(s.total_paid)}
                          </TableCell>
                          <TableCell className="text-right text-red-700">
                            {s.net_fee != null ? fmtCurrency(s.balance) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={sb.className}>
                              {sb.label}
                            </Badge>
                          </TableCell>
                          <TableCell className={danger ? 'text-red-700 font-semibold' : 'text-gray-600'}>
                            {s.due_date ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className={`h-3.5 w-3.5 ${danger ? 'text-red-500' : 'text-gray-400'}`} />
                                {fmtDate(s.due_date)}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openDetail(s.student_id)}
                                aria-label={`View ${name}`}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openAssignForStudent(s)}
                                aria-label={`${s.fee_id ? 'Edit' : 'Assign'} fee for ${name}`}
                                title={s.fee_id ? 'Edit fee' : 'Assign fee'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openRecordPayment(s)}
                                aria-label={`Record payment for ${name}`}
                                title="Record payment"
                                disabled={!s.fee_id}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openDownloadOptions(s)}
                                aria-label={`Download fee receipts for ${name}`}
                                title={s.fee_id ? 'Download receipts' : 'Assign a fee first'}
                                disabled={!s.fee_id || (downloadLoading && downloadStudent?.student_id === s.student_id)}
                              >
                                {downloadLoading && downloadStudent?.student_id === s.student_id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <FileDown className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <TablePagination
            selectId="fee-page-size"
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50]}
          />
        </CardContent>
      </Card>

      {/* Assign Fee Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={(open) => {
        setIsAssignOpen(open);
        if (!open) {
          setAssignForm(emptyAssignForm());
          setAssignFeeItems([]);
          setAssignPayments([]);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {assignForm.addToExisting
                ? 'Add to Fee'
                : assignForm.studentId && students.find((s) => s.student_id === assignForm.studentId)?.fee_id
                  ? 'Update Fee'
                  : 'Assign Fee'}
            </DialogTitle>
            <DialogDescription>
              {assignForm.addToExisting
                ? 'Enter amounts to add on top of the existing fee for this year'
                : 'Set total fee and discount for the selected student'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
              Student: <span className="font-medium">
                {(() => {
                  const found = students.find((s) => s.student_id === assignForm.studentId);
                  return found
                    ? `${[found.first_name, found.last_name].filter(Boolean).join(' ')} (${found.roll_number})`
                    : assignForm.studentId;
                })()}
              </span>
            </div>

            {(assignItemsLoading || assignFeeItems.length > 0) ? (
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Existing fee types</p>
                {assignItemsLoading ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : (
                  <ul className="space-y-2">
                    {assignFeeItems.map((item) => {
                      const amt = Number(item.amount) || 0;
                      const disc = Number(item.discount) || 0;
                      const net = item.net != null ? Number(item.net) : amt - disc;
                      return (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.fee_name || '—'}</p>
                            <p className="text-xs text-gray-600">
                              {fmtCurrency(amt)}
                              {disc > 0 ? ` − ${fmtCurrency(disc)} disc` : ''}
                              {' = '}
                              <span className="font-medium">{fmtCurrency(net)}</span>
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 h-8 px-2 shrink-0"
                            title="Delete fee type"
                            onClick={() => openDeleteFeeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {!assignForm.addToExisting && assignFeeItems.length > 0 ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                    Saving without “Add to existing” will replace totals and clear these fee types, keeping only the new fee name you enter below.
                  </p>
                ) : null}
              </div>
            ) : null}

            {(assignItemsLoading || assignPayments.length > 0) ? (
              <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 space-y-2">
                <p className="text-xs font-semibold text-gray-700">Payment history</p>
                {assignItemsLoading ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : (
                  <ul className="space-y-2">
                    {assignPayments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {fmtCurrency(p.amount)}
                            <span className="ml-1.5 text-xs font-normal text-gray-500 capitalize">
                              {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600">
                            {fmtDate(p.payment_date)}
                            {[p.reference_number, p.receipt_number].filter(Boolean).length
                              ? ` · ${[p.reference_number, p.receipt_number].filter(Boolean).join(' / ')}`
                              : ''}
                          </p>
                        </div>
                        {p.gateway_payment_id ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs shrink-0">Gateway</Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 h-8 px-2 shrink-0"
                            title="Delete payment"
                            onClick={() => openDeletePayment(p.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2.5 cursor-pointer">
              <Checkbox
                checked={assignForm.addToExisting}
                onCheckedChange={(c) => {
                  const on = Boolean(c);
                  updateAssign({
                    addToExisting: on,
                    ...(on ? { totalFee: '', discount: '0' } : {}),
                  });
                }}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">
                <span className="font-medium">Add to existing fee</span>
                <span className="block text-gray-600 mt-0.5">
                  Adds this total and discount on top of any fee already set for this year (net = total − discount).
                </span>
              </span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="assign-fee-name">Fee name *</Label>
              <Input
                id="assign-fee-name"
                placeholder="e.g. Tuition fee, Bus fee, Uniform"
                value={assignForm.feeName}
                onChange={(e) => updateAssign({ feeName: e.target.value.slice(0, 120) })}
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-ay">Academic Year *</Label>
                <Input
                  id="assign-ay"
                  placeholder="Enter academic year"
                  value={assignForm.academicYear}
                  onChange={(e) => updateAssign({ academicYear: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-total">{assignForm.addToExisting ? 'Amount to add *' : 'Total Fee *'}</Label>
                <Input
                  id="assign-total"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={assignForm.totalFee}
                  onChange={(e) => updateAssign({ totalFee: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-discount">
                  {assignForm.addToExisting ? 'Discount on this amount' : 'Discount / Scholarship'}
                </Label>
                <Input
                  id="assign-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={assignForm.discount}
                  onChange={(e) => updateAssign({ discount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-due">Due Date</Label>
                <DatePicker
                  selected={assignForm.dueDate}
                  onChange={(d) => updateAssign({ dueDate: d })}
                  dateFormat="dd-MM-yyyy"
                  isClearable
                  preventOpenOnFocus
                  shouldCloseOnSelect
                  customInput={<DatePickerInput id="assign-due" placeholder="dd-mm-yyyy" className="w-full" />}
                  wrapperClassName="w-full"
                  popperPlacement="bottom-start"
                />
              </div>
            </div>
            {assignForm.totalFee && (
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {assignForm.addToExisting ? 'Net amount added: ' : 'Net fee payable: '}
                <span className="font-semibold">
                  {fmtCurrency(Math.max(0, (Number(assignForm.totalFee) || 0) - (Number(assignForm.discount) || 0)))}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="assign-notes">Notes</Label>
              <Textarea
                id="assign-notes"
                placeholder="Enter remarks"
                value={assignForm.notes}
                onChange={(e) => updateAssign({ notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAssignOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleAssignSubmit} disabled={saving}>
                {saving ? (
                  <><Spinner className="h-4 w-4" /> Saving…</>
                ) : assignForm.addToExisting ? (
                  'Add to Fee'
                ) : (
                  'Save Fee'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={(open) => { setIsPaymentOpen(open); if (!open) setPaymentForm(emptyPaymentForm()); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>{paymentStudentName ? `For ${paymentStudentName}` : 'Enter payment details'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pay-amount">Amount *</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => updatePayment({ amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-date">Payment Date *</Label>
                <DatePicker
                  selected={paymentForm.paymentDate}
                  onChange={(d) => updatePayment({ paymentDate: d })}
                  dateFormat="dd-MM-yyyy"
                  maxDate={new Date()}
                  preventOpenOnFocus
                  shouldCloseOnSelect
                  customInput={<DatePickerInput id="pay-date" placeholder="dd-mm-yyyy" className="w-full" />}
                  wrapperClassName="w-full"
                  popperPlacement="bottom-start"
                />
              </div>
            </div>
            <FormSelect
              id="pay-method"
              label="Payment Method"
              required
              value={paymentForm.paymentMethod}
              onValueChange={(v) => updatePayment({ paymentMethod: v })}
              placeholder="Select method"
              options={PAYMENT_METHODS}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pay-ref">Reference / Txn No</Label>
                <Input
                  id="pay-ref"
                  placeholder="Enter reference number"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => updatePayment({ referenceNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-receipt">Receipt Number</Label>
                <Input
                  id="pay-receipt"
                  placeholder="Enter receipt number"
                  value={paymentForm.receiptNumber}
                  onChange={(e) => updatePayment({ receiptNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-notes">Notes</Label>
              <Textarea
                id="pay-notes"
                placeholder="Enter remarks"
                value={paymentForm.notes}
                onChange={(e) => updatePayment({ notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handlePaymentSubmit} disabled={saving}>
                {saving ? <><Spinner className="h-4 w-4" /> Saving…</> : 'Record Payment'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Fee Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <DialogContent className="sm:max-w-2xl">
          {detailStatus === 'loading' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32 mx-auto sm:mx-0" />
                <Skeleton className="h-3 w-48 mx-auto sm:mx-0" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <Card key={i} className="border-gray-200">
                    <CardContent className="px-2 py-3 sm:pt-4 sm:pb-3 sm:px-4 text-center space-y-2">
                      <Skeleton className="h-3 w-12 mx-auto" />
                      <Skeleton className="h-6 w-16 mx-auto" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Skeleton className="h-3 w-40" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  {Array.from({ length: 2 }, (_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : !detailFee ? (
            <div className="py-8 text-center text-gray-500">No fee record found for this student and academic year.</div>
          ) : (
            <div className="space-y-4 sm:space-y-5">
              <DialogHeader>
                <DialogTitle>Fee Details</DialogTitle>
                <DialogDescription>Academic Year: {detailFee.academic_year}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <Card className="border-gray-200">
                  <CardContent className="px-2 py-3 sm:pt-4 sm:pb-3 sm:px-4 text-center">
                    <p className="text-[10px] sm:text-xs text-gray-500">Net Fee</p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900">{fmtCurrency(detailFee.net_fee)}</p>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="px-2 py-3 sm:pt-4 sm:pb-3 sm:px-4 text-center">
                    <p className="text-[10px] sm:text-xs text-gray-500">Total Paid</p>
                    <p className="text-base sm:text-lg font-semibold text-green-700">{fmtCurrency(detailFee.total_paid)}</p>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="px-2 py-3 sm:pt-4 sm:pb-3 sm:px-4 text-center">
                    <p className="text-[10px] sm:text-xs text-gray-500">Balance</p>
                    <p className="text-base sm:text-lg font-semibold text-red-700">{fmtCurrency(detailFee.balance)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                {detailFee.total_fee !== detailFee.net_fee ? (
                  <span>Total fee: {fmtCurrency(detailFee.total_fee)} &mdash; Discount: {fmtCurrency(detailFee.discount)}</span>
                ) : null}
                {detailFee.due_date ? (
                  <span className={isDanger(detailFee.due_date, detailFee.net_fee, detailFee.total_paid) ? 'text-red-700 font-semibold' : ''}>
                    Due: {fmtDate(detailFee.due_date)}
                  </span>
                ) : null}
              </div>

              {detailFee.notes ? (
                <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2">
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap wrap-break-word">{detailFee.notes}</p>
                </div>
              ) : null}

              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Fee types ({detailFeeItems.length})
                </h4>
                {detailFeeItems.length === 0 ? (
                  <p className="text-sm text-gray-500">No named fee types recorded for this year.</p>
                ) : (
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Fee name</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Discount</TableHead>
                            <TableHead className="text-right">Net</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailFeeItems.map((item) => {
                            const amt = Number(item.amount) || 0;
                            const disc = Number(item.discount) || 0;
                            const net = item.net != null ? Number(item.net) : amt - disc;
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium text-gray-900">{item.fee_name || '—'}</TableCell>
                                <TableCell className="text-right">{fmtCurrency(amt)}</TableCell>
                                <TableCell className="text-right">{fmtCurrency(disc)}</TableCell>
                                <TableCell className="text-right font-medium">{fmtCurrency(net)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment History ({detailFee.payment_count ?? detailPayments.length})</h4>
                {detailPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">No payments recorded yet.</p>
                ) : (
                  <>
                    {/* Mobile card layout */}
                    <div className="space-y-3 sm:hidden">
                      {detailPayments.map((p) => (
                        <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              {fmtDate(p.payment_date)}
                            </span>
                            <span className="text-sm font-semibold text-green-700">{fmtCurrency(p.amount)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="capitalize">
                              {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method}
                            </span>
                            <span>{[p.reference_number, p.receipt_number].filter(Boolean).join(' / ') || '—'}</span>
                          </div>
                          {p.notes ? <p className="mt-1.5 text-xs text-gray-500 wrap-break-word">{p.notes}</p> : null}
                          {p.gateway_payment_id ? (
                            <div className="mt-2 flex justify-end">
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-xs">Gateway</Badge>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block rounded-lg border border-gray-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Ref / Receipt</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailPayments.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="text-gray-700">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                    {fmtDate(p.payment_date)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-medium text-green-700">
                                  {fmtCurrency(p.amount)}
                                </TableCell>
                                <TableCell className="text-gray-600 capitalize">
                                  {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method}
                                  {p.gateway_payment_id ? (
                                    <Badge variant="secondary" className="ml-2 bg-blue-50 text-blue-700 text-xs">Gateway</Badge>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-gray-600 text-sm">
                                  {[p.reference_number, p.receipt_number].filter(Boolean).join(' / ') || '—'}
                                </TableCell>
                                <TableCell className="text-gray-600 text-sm max-w-48 truncate" title={p.notes || ''}>
                                  {p.notes || '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <Button type="button" variant="outline" onClick={closeDetail}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Fee Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={(open) => { setIsBulkOpen(open); if (!open) setBulkForm(emptyBulkForm()); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{bulkForm.addToExisting ? 'Bulk Add Fee' : 'Bulk Assign Fee'}</DialogTitle>
            <DialogDescription>
              {bulkForm.addToExisting
                ? `Add the same amount on top of existing fees for all students in a class or section for ${academicYear}`
                : `Set the same fee for all students in a class or section for ${academicYear}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormSelect
                id="bulk-class"
                label="Class"
                required
                value={bulkForm.classId}
                onValueChange={(v) => updateBulk({ classId: v, sectionId: '' })}
                placeholder="Select class"
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
              {bulkSectionOptions.length > 0 ? (
                <FormSelect
                  id="bulk-section"
                  label="Section"
                  value={bulkForm.sectionId}
                  onValueChange={(v) => updateBulk({ sectionId: v })}
                  placeholder="All Sections"
                  options={[{ value: '', label: 'All Sections' }, ...bulkSectionOptions]}
                />
              ) : (
                <div className="space-y-2">
                  <Label className="text-gray-400">Section</Label>
                  <Input disabled placeholder="No sections" />
                </div>
              )}
            </div>
            <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2.5 cursor-pointer">
              <Checkbox
                checked={bulkForm.addToExisting}
                onCheckedChange={(c) => updateBulk({ addToExisting: Boolean(c) })}
                className="mt-0.5"
              />
              <span className="text-sm text-gray-800">
                <span className="font-medium">Add to existing fee</span>
                <span className="block text-gray-600 mt-0.5">
                  Adds this total and discount on top of any fee already set for this year (net = total − discount).
                </span>
              </span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="bulk-fee-name">Fee name *</Label>
              <Input
                id="bulk-fee-name"
                placeholder="e.g. Tuition fee, Bus fee, Uniform"
                value={bulkForm.feeName}
                onChange={(e) => updateBulk({ feeName: e.target.value.slice(0, 120) })}
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-total">{bulkForm.addToExisting ? 'Amount to add *' : 'Total Fee *'}</Label>
                <Input
                  id="bulk-total"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={bulkForm.totalFee}
                  onChange={(e) => updateBulk({ totalFee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-discount">
                  {bulkForm.addToExisting ? 'Discount on this amount' : 'Discount / Scholarship'}
                </Label>
                <Input
                  id="bulk-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={bulkForm.discount}
                  onChange={(e) => updateBulk({ discount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-due">Due Date</Label>
              <DatePicker
                selected={bulkForm.dueDate}
                onChange={(d) => updateBulk({ dueDate: d })}
                dateFormat="dd-MM-yyyy"
                isClearable
                preventOpenOnFocus
                shouldCloseOnSelect
                customInput={<DatePickerInput id="bulk-due" placeholder="dd-mm-yyyy" className="w-full" />}
                wrapperClassName="w-full"
                popperPlacement="bottom-start"
              />
            </div>
            {bulkForm.totalFee && (
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {bulkForm.addToExisting ? 'Net amount added per student: ' : 'Net fee per student: '}
                <span className="font-semibold">
                  {fmtCurrency(Math.max(0, (Number(bulkForm.totalFee) || 0) - (Number(bulkForm.discount) || 0)))}
                </span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="bulk-notes">Notes</Label>
              <Textarea
                id="bulk-notes"
                placeholder="Enter remarks"
                value={bulkForm.notes}
                onChange={(e) => updateBulk({ notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
              <Button type="button" onClick={handleBulkSubmit} disabled={saving}>
                {saving ? (
                  <><Spinner className="h-4 w-4" /> Saving…</>
                ) : bulkForm.addToExisting ? (
                  'Add to Class'
                ) : (
                  'Assign to Class'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Download receipts options */}
      <Dialog open={isDownloadOpen} onOpenChange={(open) => { if (!open) closeDownloadOptions(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Download receipts</DialogTitle>
            <DialogDescription>
              {downloadStudent
                ? `${[downloadStudent.first_name, downloadStudent.last_name].filter(Boolean).join(' ')} (${downloadStudent.roll_number})`
                : 'Choose a receipt to download'}
            </DialogDescription>
          </DialogHeader>

          {downloadLoading || !downloadFee ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Complete fee record</p>
                <p className="text-xs text-gray-600">
                  Full statement with fee types, totals, and all payment installments.
                </p>
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={handleDownloadFullRecord}
                  disabled={Boolean(downloadBusy)}
                >
                  {downloadBusy === 'full' ? (
                    <><Spinner className="h-4 w-4" /> Downloading…</>
                  ) : (
                    <><FileDown className="h-4 w-4" /> Download complete record</>
                  )}
                </Button>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Payment receipts</p>
                <p className="text-xs text-gray-600">
                  Download a receipt for one payment to give to the parent.
                </p>
                {downloadPayments.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No payments recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {downloadPayments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {fmtCurrency(p.amount)}
                            <span className="ml-1.5 text-xs font-normal text-gray-500 capitalize">
                              {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ?? p.payment_method}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600">{fmtDate(p.payment_date)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => handleDownloadPaymentReceipt(p)}
                          disabled={Boolean(downloadBusy)}
                        >
                          {downloadBusy === p.id ? (
                            <Spinner className="h-3.5 w-3.5" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5" />
                          )}
                          Receipt
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end pt-1">
                <Button type="button" variant="outline" onClick={closeDownloadOptions} disabled={Boolean(downloadBusy)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Payment Confirmation */}
      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={(open) => { setIsDeleteOpen(open); if (!open) setDeletingPaymentId(null); }}
        title="Delete this payment?"
        description="This will permanently remove the payment record and update the student's balance. This action cannot be undone."
        confirmText="Delete"
        confirmBusyText="Deleting…"
        onConfirm={handleDeletePayment}
      />

      {/* Delete Fee Type Confirmation */}
      <DeleteConfirmDialog
        open={isDeleteFeeItemOpen}
        onOpenChange={(open) => { setIsDeleteFeeItemOpen(open); if (!open) setDeletingFeeItemId(null); }}
        title="Delete this fee type?"
        description={
          deletingFeeItem
            ? `“${deletingFeeItem.fee_name || 'This fee'}” (${fmtCurrency(Number(deletingFeeItem.amount) || 0)}) will be removed and the student’s total fee will be reduced by the same amount. This cannot be undone.`
            : 'This fee type will be removed and the student’s total fee will be reduced. This cannot be undone.'
        }
        confirmText="Delete"
        confirmBusyText="Deleting…"
        onConfirm={handleDeleteFeeItem}
      />

      {/* Bulk replace warning */}
      <DeleteConfirmDialog
        open={isBulkReplaceWarnOpen}
        onOpenChange={setIsBulkReplaceWarnOpen}
        title="Replace existing fees?"
        description="This option will replace the existing fees for all students in the selected class or section. Kindly review the details once before confirming."
        confirmText="Replace fees"
        confirmBusyText="Updating…"
        cancelText="Cancel"
        onConfirm={runBulkAssign}
        maxWidthClassName="max-w-lg"
      />
    </div>
  );
}
