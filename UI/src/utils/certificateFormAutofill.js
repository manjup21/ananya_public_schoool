/** Scoped autocomplete tokens so Chrome autofill targets certificate dialogs, not page search. */
export function certificateAc(token) {
  return `section-certificate ${token}`;
}
