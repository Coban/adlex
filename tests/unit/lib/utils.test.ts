import { describe, expect, it } from "vitest";

import { cn, formatDate } from "@/lib/utils";

describe("ユーティリティ", () => {
  describe("cn (クラス名マージャー)", () => {
    it("クラス名を正しくマージすること", () => {
      const result = cn("base-class", "additional-class");
      expect(result).toContain("base-class");
      expect(result).toContain("additional-class");
    });

    it("条件付きクラスを適切に処理すること", () => {
      const result = cn("base", true && "conditional", false && "hidden");
      expect(result).toContain("base");
      expect(result).toContain("conditional");
      expect(result).not.toContain("hidden");
    });

    it("undefinedとnull値を適切に処理すること", () => {
      const result = cn("base", undefined, null, "valid");
      expect(result).toContain("base");
      expect(result).toContain("valid");
    });
  });

  describe("日付フォーマット", () => {
    it("日付文字列を正しくフォーマットすること", () => {
      const dateString = "2024-01-15T10:30:00Z";
      const result = formatDate(dateString);

      // Should be in Japanese format (YYYY/MM/DD HH:MM)
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}/);
      expect(result).toMatch(/\d{2}:\d{2}$/);
    });

    it("Dateオブジェクトを正しくフォーマットすること", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = formatDate(date);

      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}/);
      expect(result).toMatch(/\d{2}:\d{2}$/);
    });

    it("異なる日付形式を一貫して処理すること", () => {
      const dateString = "2024-01-15T10:30:00Z";
      const dateObject = new Date(dateString);

      const result1 = formatDate(dateString);
      const result2 = formatDate(dateObject);

      expect(result1).toBe(result2);
    });
  });
});
