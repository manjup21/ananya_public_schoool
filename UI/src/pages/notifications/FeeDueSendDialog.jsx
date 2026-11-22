import { useEffect, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { DatePickerInput } from '../../components/common/DatePickerInput';
import { AlertTriangle, MessageSquare, RefreshCw, Send, Users } from 'lucide-react';
import {
  FEE_DUE_DATE_FALLBACK,
  buildFeeDueMessage,
  channelLabel,
  fmtDateTime,
  formatFeeDueDateForMessage,
  NOTIFICATIONS_SEND_DISABLED,
  NOTIFICATIONS_SEND_DISABLED_TITLE,
} from './notificationHelpers';
import { toIsoDate } from '../../utils/dateOnly';

function fmtCurrency(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/**
 * Fee-due send confirm dialog: recipients, optional due date, live message preview.
 */
export function FeeDueSendDialog({
  open,
  onOpenChange,
  channel = 'whatsapp',
  recipients = [],
  schoolName,
  schoolPhone,
  title = 'Send Fee Due Reminder',
  sending = false,
  onConfirm,
  isResend = false,
  alreadySentCount = 0,
  lastSentAt,
  lastSentChannel,
}) {
  const [dueDate, setDueDate] = useState(null);

  useEffect(() => {
    if (open) setDueDate(null);
  }, [open]);

  const dueDateIso = toIsoDate(dueDate);
  const dueDateLabel = formatFeeDueDateForMessage(dueDateIso);

  const previewStudent = recipients[0];
  const previewMessage = useMemo(() => {
    if (!previewStudent) return '';
    return buildFeeDueMessage({
      studentName: previewStudent.student_name,
      balance: previewStudent.balance,
      dueDate: dueDateIso,
      schoolName,
      schoolPhone,
      channel,
    });
  }, [previewStudent, dueDateIso, schoolName, schoolPhone, channel]);

  const recipientCount = recipients.length;
  const shownNames = recipients.slice(0, 5);
  const remaining = Math.max(0, recipientCount - shownNames.length);
  const mixedAlreadySent =
    !isResend && alreadySentCount > 0 && alreadySentCount < recipientCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {isResend && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {channelLabel(lastSentChannel || channel)} notifications were already sent
                {lastSentAt ? (
                  <>
                    {' '}
                    on <span className="font-medium">{fmtDateTime(lastSentAt)}</span>
                  </>
                ) : null}
                . Guardians will receive a duplicate message.
              </p>
            </div>
          )}

          {mixedAlreadySent && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-medium">{alreadySentCount}</span> of{' '}
                <span className="font-medium">{recipientCount}</span> selected guardians were already
                notified. They will receive another message.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Channel:</span>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {channelLabel(channel)}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">
                Sending to {recipientCount} guardian{recipientCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-40 overflow-y-auto">
              <ul className="space-y-2 text-sm">
                {shownNames.map((s) => (
                  <li key={s.student_id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{s.student_name}</p>
                        {s.notification_status === 'sent' && (
                          <Badge variant="secondary" className="bg-green-50 text-green-700 shrink-0">
                            Sent
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">Roll {s.roll_number || '—'}</p>
                    </div>
                    <span className="shrink-0 font-semibold text-gray-800">
                      ₹{fmtCurrency(s.balance)}
                    </span>
                  </li>
                ))}
              </ul>
              {remaining > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  +{remaining} more student{remaining !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee-send-due-date">Due date (optional)</Label>
            <DatePicker
              id="fee-send-due-date"
              selected={dueDate}
              onChange={(d) => setDueDate(d)}
              dateFormat="dd-MM-yyyy"
              placeholderText="dd-mm-yyyy"
              isClearable
              customInput={<DatePickerInput placeholder="dd-mm-yyyy" className="w-full" />}
            />
            <p className="text-xs text-gray-500">
              {dueDateIso ? (
                <>Parents will be told the fee is due on {dueDateLabel}.</>
              ) : (
                <>Leave blank to tell parents the fee is due on {FEE_DUE_DATE_FALLBACK}.</>
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">
              Message preview
              {recipientCount > 1 ? ' (sample — first student)' : ''}:
            </span>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {previewMessage}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex-col-reverse sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm?.({ dueDate: dueDateIso })}
            disabled={NOTIFICATIONS_SEND_DISABLED || sending || recipientCount === 0}
            title={NOTIFICATIONS_SEND_DISABLED ? NOTIFICATIONS_SEND_DISABLED_TITLE : undefined}
          >
            {sending ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Sending…
              </>
            ) : isResend ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resend {recipientCount} Message{recipientCount !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {recipientCount} Message{recipientCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
