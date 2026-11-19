import { type ClassValue, clsx } from "clsx";

/** Gabungkan nama kelas. Kelasnya hanya boleh token (B4). */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
