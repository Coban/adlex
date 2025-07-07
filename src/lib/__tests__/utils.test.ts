import { describe, expect, it } from "vitest";

import { cn, formatDate } from "../utils";

describe("utils", () => {
  describe("cn (className merger)", () => {
    it("should merge class names correctly", () => {
      const result = cn("base-class", "additional-class");
      expect(result).toContain("base-class");
      expect(result).toContain("additional-class");
    });

    it("should handle conditional classes", () => {
      const result = cn("base", true && "conditional", false && "hidden");
      expect(result).toContain("base");
      expect(result).toContain("conditional");
      expect(result).not.toContain("hidden");
    });

    it("should handle undefined and null values", () => {
      const result = cn("base", undefined, null, "valid");
      expect(result).toContain("base");
      expect(result).toContain("valid");
    });
  });

  describe("formatDate", () => {
    it("should format date string correctly", () => {
      const dateString = "2024-01-15T10:30:00Z";
      const result = formatDate(dateString);

      // Should be in Japanese format (YYYY/MM/DD HH:MM)
      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}/);
      expect(result).toMatch(/\d{2}:\d{2}$/);
    });

    it("should format Date object correctly", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = formatDate(date);

      expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2}/);
      expect(result).toMatch(/\d{2}:\d{2}$/);
    });

    it("should handle different date formats consistently", () => {
      const dateString = "2024-01-15T10:30:00Z";
      const dateObject = new Date(dateString);

      const result1 = formatDate(dateString);
      const result2 = formatDate(dateObject);

      expect(result1).toBe(result2);
    });
  });
});
