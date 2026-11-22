import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { Info, MessageSquare, Send } from 'lucide-react';
import { channelLabel, buildAttendanceMessage } from './notificationHelpers';

/**
 * Bulk send confirmation dialog for attendance notifications.
 *
 * Props:
 *  - open / onOpenChange
 *  - channel: 'sms' | 'whatsapp'
 *  - unsentSections: array of { class_name, section_code, absent_count }
 *  - schoolName: string
 *  - date: ISO date string (for message preview)
 *  - sending: boolean
 *  - onConfirm: callback
 */
export function BulkSendConfirmDialog({
  open,
  onOpenChange,
  channel,
  unsentSections = [],
  schoolName,
  date,
  sending = false,
  onConfirm,
}) {
  const totalStudents = unsentSections.reduce((sum, s) => sum + (s.absent_count || 0), 0);

  const previewMessage = buildAttendanceMessage({
    studentName: 'Student Name',
    date,
    slots: [1, 2],
    schoolName,
    channel,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] mx-auto">
        <DialogHeader>
          <DialogTitle>Send Bulk Attendance Notifications</DialogTitle>
          <DialogDescription>
            Review the details below before sending to all unsent sections.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Channel:</span>
            <Badge
              variant="secondary"
              className={
                channel === 'whatsapp'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-blue-50 text-blue-700'
              }
            >
              {channelLabel(channel)}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-600">Sections: </span>
              <span className="font-semibold text-gray-900">{unsentSections.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Total guardians: </span>
              <span className="font-semibold text-gray-900">{totalStudents}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Sections to notify:</span>
            <div className="rounded-lg border border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100">
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Class</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Section</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {unsentSections.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-1.5 text-gray-800">{s.class_name}</td>
                      <td className="px-3 py-1.5 text-gray-600">{s.section_code || '\u2014'}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-red-600">{s.absent_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Sample message:</span>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 mt-0.5 text-gray-400 shrink-0" />
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {previewMessage}
                </p>
              </div>
            </div>
            {channel === 'sms' && previewMessage && (
              <p className={`text-xs text-right ${previewMessage.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                {previewMessage.length}/160 characters{previewMessage.length > 160 ? ' (2 credits)' : ' (1 credit)'}
              </p>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Sections that have already been sent or are currently processing will be skipped.
              Each student&apos;s actual message will include their specific details.
            </p>
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
            onClick={onConfirm}
            disabled={sending}
          >
            {sending ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send {totalStudents} Message{totalStudents !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
