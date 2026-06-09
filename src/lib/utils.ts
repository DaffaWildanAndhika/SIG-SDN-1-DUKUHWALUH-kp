/**
 * utils.ts
 * Utilitas pembantu untuk menggabungkan kelas CSS (class names merging) secara kondisional
 * dengan dukungan clsx dan tailwind-merge (fungsi cn).
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
