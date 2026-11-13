import {
  toCents,
  fromCents,
  addCents,
  subtractCents,
  multiplyCents,
  divideCents,
  splitInstallments,
  calculateInterest,
  formatCents,
} from "../money";

describe("Utilidades Financieras y Precisión Monetaria (money.ts)", () => {
  describe("toCents", () => {
    it("convierte decimales estándar a centavos enteros", () => {
      expect(toCents(10.5)).toBe(1050);
      expect(toCents(100)).toBe(10000);
      expect(toCents(0)).toBe(0);
    });

    it("resuelve correctamente imprecisiones clásicas de punto flotante de IEEE 754", () => {
      // 19.99 * 100 en JS produce 1998.9999999999998
      expect(toCents(19.99)).toBe(1999);

      // 0.1 + 0.2 en JS produce 0.30000000000000004
      expect(toCents(0.1 + 0.2)).toBe(30);

      // 1.05 * 100 a veces produce 104.99999999999999
      expect(toCents(1.05)).toBe(105);
    });

    it("maneja valores nulos o indefinidos retornando 0", () => {
      expect(toCents(null)).toBe(0);
      expect(toCents(undefined)).toBe(0);
      expect(toCents(NaN)).toBe(0);
    });
  });

  describe("fromCents", () => {
    it("convierte centavos a float con exactitud", () => {
      expect(fromCents(1050)).toBe(10.5);
      expect(fromCents(1999)).toBe(19.99);
      expect(fromCents(0)).toBe(0);
      expect(fromCents(null)).toBe(0);
    });
  });

  describe("operaciones matemáticas en centavos", () => {
    it("suma centavos sin pérdidas de precisión", () => {
      expect(addCents(toCents(0.1), toCents(0.2))).toBe(30);
      expect(addCents(1000, 2550, 450)).toBe(4000);
      expect(addCents(null, undefined, 500)).toBe(500);
    });

    it("resta centavos con exactitud", () => {
      expect(subtractCents(5000, 1250)).toBe(3750);
      expect(subtractCents(100, 200)).toBe(-100);
    });

    it("multiplica y divide redondeando al centavo entero más cercano", () => {
      expect(multiplyCents(1000, 1.21)).toBe(1210); // IVA 21%
      expect(divideCents(1000, 3)).toBe(333);
    });
  });

  describe("splitInstallments (Reparto bancario de cuotas)", () => {
    it("divide un importe exacto en partes iguales", () => {
      const cuotas = splitInstallments(120000, 6); // $1.200 en 6 cuotas
      expect(cuotas).toEqual([20000, 20000, 20000, 20000, 20000, 20000]);
      expect(cuotas.reduce((a, b) => a + b, 0)).toBe(120000);
    });

    it("asigna los centavos sobrantes de redondeo a las primeras cuotas garantizando la suma total", () => {
      // $100.00 (10.000 centavos) en 3 cuotas = 3333.333...
      const cuotas = splitInstallments(10000, 3);
      expect(cuotas).toEqual([3334, 3333, 3333]);
      expect(cuotas.reduce((a, b) => a + b, 0)).toBe(10000);

      // $10.00 (1.000 centavos) en 3 cuotas = 333.333...
      const cuotas2 = splitInstallments(1000, 3);
      expect(cuotas2).toEqual([334, 333, 333]);
      expect(cuotas2.reduce((a, b) => a + b, 0)).toBe(1000);
    });

    it("maneja caso borde de 1 cuota", () => {
      expect(splitInstallments(5000, 1)).toEqual([5000]);
    });
  });

  describe("calculateInterest (Recargo e interés implícito)", () => {
    it("calcula recargo cuando el total financiado supera el precio de contado", () => {
      const res = calculateInterest(10000, 12000); // Contado $100, financiado $120
      expect(res.interestCents).toBe(2000); // $20 de interés
      expect(res.surchargePercent).toBe(20); // 20%
    });

    it("retorna 0 si es sin interés", () => {
      const res = calculateInterest(10000, 10000);
      expect(res.interestCents).toBe(0);
      expect(res.surchargePercent).toBe(0);
    });
  });

  describe("formatCents", () => {
    it("formatea centavos como moneda localizada", () => {
      const formatted = formatCents(150000, "ARS"); // $1.500
      expect(formatted).toContain("1.500");
    });
  });
});

