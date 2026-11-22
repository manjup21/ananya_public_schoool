import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { fetchClassesThunk } from './classesSlice';

/** Classes from the store, fetched once on first use. */
export function useClasses() {
  const dispatch = useDispatch();
  const classes = useSelector((s) => s.classes.items);
  const classesStatus = useSelector((s) => s.classes.status);

  useEffect(() => {
    if (classesStatus === 'idle') dispatch(fetchClassesThunk());
  }, [classesStatus, dispatch]);

  return { classes, classesStatus };
}

export const sectionLabel = (s) => String(s.section ?? s.section_code ?? 'Section').trim() || 'Section';
export const plainSectionLabel = (s) => s.section ?? 'Section';

/** Class + section dropdown options (string ids); sections are empty until a class is picked. */
export function useClassSectionOptions(classId, { formatSection = sectionLabel } = {}) {
  const { classes, classesStatus } = useClasses();

  const classOptions = useMemo(
    () => (classes ?? []).map((c) => ({ value: String(c.id), label: c.name ?? 'Class' })),
    [classes]
  );

  const sectionOptions = useMemo(() => {
    if (!classId || classId === 'all') return [];
    const cls = (classes ?? []).find((c) => String(c.id) === String(classId));
    const secs = Array.isArray(cls?.sections) ? cls.sections : [];
    return secs.map((s) => ({ value: String(s.id), label: formatSection(s) }));
  }, [classId, classes, formatSection]);

  const classNameFor = useMemo(() => {
    const map = new Map();
    for (const c of classes ?? []) map.set(String(c.id), c.name ?? '—');
    return (id) => map.get(String(id)) ?? '—';
  }, [classes]);

  const sectionCodeFor = useMemo(() => {
    const map = new Map();
    for (const c of classes ?? []) {
      for (const s of c.sections ?? []) map.set(String(s.id), s.section ?? '—');
    }
    return (id) => map.get(String(id)) ?? '—';
  }, [classes]);

  return { classes, classesStatus, classOptions, sectionOptions, classNameFor, sectionCodeFor };
}
