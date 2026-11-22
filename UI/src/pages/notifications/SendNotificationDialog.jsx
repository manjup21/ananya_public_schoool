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
import { AlertTriangle, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { channelLabel, fmtDateTime } from './notificationHelpers';

/**
 * Reusable dialog that previews the notification message and confirms sending.
 *
 * Props:
 *  - open / onOpenChange: dialog state
 *  - channel: 'sms' | 'whatsapp'
 *  - recipientCount: number of guardians who will receive the message
 *  - previewMessage: the rendered message string
 *  - title: dialog title text
 *  - sending: boolean — show spinner on the send button
 *  - onConfirm: callback when user clicks Send
 *  - isResend: boolean — true when notifications were already sent
 *  - lastSentAt: ISO string — when the previous notification was sent
 *  - lastSentChannel: 'sms' | 'whatsapp' — channel of previous send
 */
export function SendNotificationDialog({
  open,
  onOpenChange,
  channel,
  recipientCount,
  previewMessage,
  title = 'Preview & Confirm Notification',
  sending = false,
  onConfirm,
  isResend = false,
  lastSentAt,
  lastSentChannel,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] mx-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the message below before sending to guardians.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {isResend && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {channelLabel(lastSentChannel || channel)} notifications were already sent
                {lastSentAt ? <> on <span className="font-medium">{fmtDateTime(lastSentAt)}</span></> : null}.
                Guardians will receive a duplicate message.
              </p>
            </div>
          )}

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

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Recipients:</span>
            <span className="text-sm text-gray-900 font-semibold">{recipientCount} guardian(s)</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Message preview:</span>
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
