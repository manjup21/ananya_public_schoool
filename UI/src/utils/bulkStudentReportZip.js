import JSZip from 'jszip';

import {
  BULK_STUDENT_REPORT_MAX,
  exportStudentProgressPdf,
  loadHeadMistressSignature,
  loadSchoolReportLogo,
  prepareReportPhoto,
  sectionsForExam,
} from './progressReportCard';
import { fetchStudentPhotosMap } from './studentPhotoDataUrl';
import { downloadBlob, mapPool, sanitizeFilePart } from './fileExport';

const PDF_CONCURRENCY = 4;

function hasExams(sections) {
  return (sections ?? []).some((section) => (section?.exams ?? []).length > 0);
}

/**
 * Build and download one ZIP containing a progress report PDF per student.
 * Reports are the entries returned by the bulk progress-report endpoint.
 */
export async function downloadBulkStudentReportZip({
  students,
  reports,
  classNameFor,
  sectionLabelFor,
  partB = null,
  totalMarks = null,
  examId = null,
  filePrefix,
  zipLabel = 'Student_Progress_Reports',
  onProgress,
}) {
  const studentList = Array.isArray(students) ? students : [];
  const reportList = Array.isArray(reports) ? reports : [];
  if (reportList.length > BULK_STUDENT_REPORT_MAX) {
    throw new Error(`At most ${BULK_STUDENT_REPORT_MAX} students per report download`);
  }

  const studentById = new Map(studentList.map((student) => [String(student?.id ?? ''), student]));
  const neededStudents = reportList
    .map((report) => report?.student || studentById.get(String(report?.studentId ?? '')))
    .filter(Boolean);
  const [photos, logoDataUrl, headMistressSigDataUrl] = await Promise.all([
    fetchStudentPhotosMap(neededStudents, 6),
    loadSchoolReportLogo(),
    loadHeadMistressSignature(),
  ]);

  let completed = 0;
  const built = await mapPool(reportList, PDF_CONCURRENCY, async (report, index) => {
    const finish = (result) => {
      completed += 1;
      onProgress?.(completed, reportList.length);
      return result;
    };

    const allSections = Array.isArray(report?.sections) ? report.sections : [];
    const sections = examId ? sectionsForExam(allSections, examId) : allSections;
    if (!hasExams(sections)) return finish({ status: 'no-exams' });

    const listStudent = report?.student || studentById.get(String(report?.studentId ?? ''));
    if (!listStudent) return finish({ status: 'failed' });
    const student = {
      ...listStudent,
      date_of_birth: listStudent.date_of_birth ?? report?.dateOfBirth ?? null,
      mother_name: listStudent.mother_name ?? report?.motherName ?? null,
    };

    try {
      const result = await exportStudentProgressPdf({
        student,
        className: classNameFor?.(student.class_id, student) ?? student.class_name ?? '',
        sectionLabel: sectionLabelFor?.(student.section_id, student) ?? student.section_name ?? '',
        sections,
        partB,
        totalMarks,
        filePrefix,
        logoDataUrl,
        headMistressSigDataUrl,
        studentPhotoDataUrl: await prepareReportPhoto(photos[String(student.id)] || null),
        returnBlob: true,
      });
      if (!result?.blob) return finish({ status: 'no-exams' });
      return finish({
        status: 'ready',
        blob: result.blob,
        filename: result.filename || `Progress_Report_${index + 1}.pdf`,
        index,
      });
    } catch {
      return finish({ status: 'failed' });
    }
  });

  const zip = new JSZip();
  const usedNames = new Set();
  let downloaded = 0;
  let skippedNoExams = 0;
  let skippedFailed = 0;

  for (const item of built) {
    if (item?.status === 'no-exams') {
      skippedNoExams += 1;
      continue;
    }
    if (item?.status !== 'ready') {
      skippedFailed += 1;
      continue;
    }
    let filename = item.filename;
    if (usedNames.has(filename)) {
      filename = `${filename.replace(/\.pdf$/i, '')}_${item.index + 1}.pdf`;
    }
    usedNames.add(filename);
    zip.file(filename, item.blob);
    downloaded += 1;
  }

  if (downloaded > 0) {
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    downloadBlob(blob, `${sanitizeFilePart(zipLabel)}.zip`);
  }

  return { downloaded, skippedNoExams, skippedFailed };
}
