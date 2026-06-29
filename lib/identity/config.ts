// Central knobs for the identity system. Bumping SCHOOL_CODE_LENGTH to 5 needs no
// migration - the column is text and codes are generated/compared as strings.
export const SCHOOL_CODE_LENGTH = 4; // 4-digit codes "1000"–"9999" (≈9,000 schools)
export const STUDENT_SEQ_PAD = 5; // NNNNN → up to 99,999 students per school per year
export const STUDENT_PASSWORD_LENGTH = 10; // readable, comfortably ≥ 8

// How many times to retry on a unique-collision before giving up.
export const SCHOOL_CODE_MAX_ATTEMPTS = 100;
export const STUDENT_ID_MAX_ATTEMPTS = 5;
