"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "./appConfig";
import type { Product } from "./products";
import type { CompatibilityResult } from "./compatibility";

export interface ScanRecord {
  product: Product;
  compatibility: CompatibilityResult;
  scannedAt: string;
}

interface ScannerState {
  history: ScanRecord[];
  closet: ScanRecord[];
  addScan: (record: ScanRecord) => void;
  addToCloset: (record: ScanRecord) => void;
  removeFromCloset: (barcode: string) => void;
}

export const useScannerStore = create<ScannerState>()(
  persist(
    (set) => ({
      history: [],
      closet: [],
      addScan: (record) =>
        set((state) => ({
          history: [record, ...state.history.filter((r) => r.product.barcode !== record.product.barcode)].slice(0, 30),
        })),
      addToCloset: (record) =>
        set((state) => ({
          closet: [record, ...state.closet.filter((r) => r.product.barcode !== record.product.barcode)],
        })),
      removeFromCloset: (barcode) =>
        set((state) => ({
          closet: state.closet.filter((r) => r.product.barcode !== barcode),
        })),
    }),
    { name: STORAGE_KEYS.scanner }
  )
);
