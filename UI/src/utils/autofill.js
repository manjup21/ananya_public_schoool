/**
 * Chrome's password manager / autofill updates inputs with an `input` event that has no typing
 * `inputType` (typing gives "insertText", paste "insertFromPaste"). Used to tell a browser fill
 * apart from the user typing.
 */
export function isAutofillEvent(e) {
  const inputType = e?.nativeEvent?.inputType;
  return inputType === undefined || inputType === 'insertReplacementText';
}
