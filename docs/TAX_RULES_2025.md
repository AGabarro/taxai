# TAX_RULES_2025.md — IRPF 2025 Complete Reference
> Fiscal year: **2025** (declared April–June 2026, campaign currently open)
> Regime: **Régimen General** applies to all 15 comunidades de régimen común.
> Navarra and País Vasco operate under **Régimen Foral** — see Section 8.
> Source verification: Agencia Tributaria Manual Renta 2025, TaxDown, Idealista Fiscalidad.
>
> ⚠️ Agent A must use this file as the authoritative source for all JSON rule files.
> Whenever a rule here conflicts with CLAUDE.md, **this file wins** — it is more current.

---

## 1. How IRPF Is Computed (Corrected Architecture)

The CLAUDE.md description of "splitting 50/50" is a simplification. The real process:

1. Compute **base imponible general** (net work income after all reductions)
2. Apply **tarifa estatal** (state brackets) to the full base → `cuotaIntegraEstatal`
3. Apply **tarifa autonómica** (regional brackets) to the full base → `cuotaIntegraAutonomica`
4. Apply the **mínimo personal y familiar** proportionally to each half to get `cuotaLiquidaEstatal` and `cuotaLiquidaAutonomica`
5. Apply any **deductions** (e.g., deducción por rendimientos del trabajo)
6. Subtract **retenciones** → `resultAmount`

The state brackets and regional brackets are each applied to the **full base** (not half each). The rates just happen to be roughly equal in magnitude, which is why the "50/50" simplification exists.

---

## 2. Tarifa Estatal 2025 (Applied to Full Base Imponible)

| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.50% |
| 12,450 | 20,200 | 12.00% |
| 20,200 | 35,200 | 15.00% |
| 35,200 | 60,000 | 18.50% |
| 60,000 | 300,000 | 22.50% |
| 300,000 | ∞ | 24.50% |

Combined top marginal rate (state + regional) ranges from **45% (Madrid)** to **54% (Comunidad Valenciana)**.

---

## 3. Tarifas Autonómicas 2025 — All 17 Autonomías

### Andalucía
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 13,000 | 9.50% |
| 13,000 | 21,000 | 12.00% |
| 21,000 | 35,200 | 15.00% |
| 35,200 | 50,000 | 18.50% |
| 50,000 | ∞ | 22.50% |

### Aragón
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 13,972.50 | 9.50% |
| 13,972.50 | 21,210 | 12.00% |
| 21,210 | 36,960 | 15.00% |
| 36,960 | 52,500 | 18.50% |
| 52,500 | 60,000 | 20.50% |
| 60,000 | 80,000 | 23.00% |
| 80,000 | 90,000 | 24.00% |
| 90,000 | 130,000 | 25.00% |
| 130,000 | ∞ | 25.50% |

### Asturias
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 10.00% |
| 12,450 | 17,700 | 12.00% |
| 17,700 | 33,007 | 14.00% |
| 33,007 | 53,407 | 18.50% |
| 53,407 | 70,000 | 21.50% |
| 70,000 | 90,000 | 22.50% |
| 90,000 | 175,000 | 25.00% |
| 175,000 | ∞ | 25.50% |

### Illes Balears
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 10,000 | 9.00% |
| 10,000 | 18,000 | 11.25% |
| 18,000 | 30,000 | 14.25% |
| 30,000 | 48,000 | 17.50% |
| 48,000 | 70,000 | 19.00% |
| 70,000 | 90,000 | 21.75% |
| 90,000 | 120,000 | 22.75% |
| 120,000 | 175,000 | 23.75% |
| 175,000 | ∞ | 24.75% |

### Canarias
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.00% |
| 12,450 | 17,707 | 11.50% |
| 17,707 | 33,007 | 14.00% |
| 33,007 | 53,407 | 18.50% |
| 53,407 | 90,000 | 23.50% |
| 90,000 | 120,000 | 25.00% |
| 120,000 | ∞ | 26.00% |

### Cantabria
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 13,000 | 8.50% |
| 13,000 | 21,000 | 11.00% |
| 21,000 | 35,200 | 14.50% |
| 35,200 | 60,000 | 18.00% |
| 60,000 | 90,000 | 22.50% |
| 90,000 | ∞ | 24.50% |

### Castilla-La Mancha
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.50% |
| 12,450 | 20,200 | 12.00% |
| 20,200 | 35,200 | 15.00% |
| 35,200 | 60,000 | 18.50% |
| 60,000 | ∞ | 22.50% |
> Mirrors the state tarifa exactly. Combined top rate = 47%.

### Castilla y León
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.00% |
| 12,450 | 20,200 | 12.00% |
| 20,200 | 35,200 | 14.00% |
| 35,200 | 53,407 | 18.50% |
| 53,407 | ∞ | 21.50% |

### Cataluña
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 10.50% |
| 12,450 | 17,707 | 12.00% |
| 17,707 | 21,000 | 14.00% |
| 21,000 | 33,007 | 15.00% |
| 33,007 | 53,407 | 18.80% |
| 53,407 | 90,000 | 21.50% |
| 90,000 | 120,000 | 23.50% |
| 120,000 | 175,000 | 24.50% |
| 175,000 | ∞ | 25.50% |
> Combined top rate with state ≈ 50%.

### Extremadura
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 8.00% |
| 12,450 | 20,200 | 10.00% |
| 20,200 | 24,200 | 16.00% |
| 24,200 | 35,200 | 17.50% |
| 35,200 | 60,000 | 21.00% |
| 60,000 | 80,200 | 23.50% |
| 80,200 | 99,200 | 24.00% |
| 99,200 | 120,200 | 24.50% |
| 120,200 | ∞ | 25.00% |

### Galicia
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,985 | 9.00% |
| 12,985 | 21,068 | 11.65% |
| 21,068 | 35,200 | 14.90% |
| 35,200 | 47,600 | 18.40% |
| 47,600 | 60,000 | 22.50% |
| 60,000 | ∞ | 22.50% |

### La Rioja
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 8.00% |
| 12,450 | 20,200 | 10.60% |
| 20,200 | 35,200 | 13.60% |
| 35,200 | 40,000 | 17.80% |
| 40,000 | 50,000 | 18.30% |
| 50,000 | 60,000 | 19.00% |
| 60,000 | 120,000 | 24.50% |
| 120,000 | ∞ | 27.00% |
> Combined top rate with state ≈ 51.5%.

### Comunidad de Madrid
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 13,362 | 8.50% |
| 13,362 | 18,004 | 10.70% |
| 18,004 | 35,425 | 12.80% |
| 35,425 | 57,320 | 17.40% |
| 57,320 | ∞ | 20.50% |
> Lowest combined top rate in Spain ≈ 45%.

### Región de Murcia
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,450 | 9.50% |
| 12,450 | 20,200 | 11.20% |
| 20,200 | 34,000 | 13.30% |
| 34,000 | 60,000 | 17.90% |
| 60,000 | ∞ | 22.50% |

### Comunidad Valenciana
| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 12,000 | 9.00% |
| 12,000 | 22,000 | 12.00% |
| 22,000 | 32,000 | 15.00% |
| 32,000 | 42,000 | 17.50% |
| 42,000 | 52,000 | 20.00% |
| 52,000 | 65,000 | 22.50% |
| 65,000 | 72,000 | 25.00% |
| 72,000 | 100,000 | 26.50% |
| 100,000 | 150,000 | 27.50% |
| 150,000 | 200,000 | 28.50% |
| 200,000 | ∞ | 29.50% |
> Highest combined top rate in Spain ≈ 54%. 11 brackets.

---

## 4. Reducción por Rendimientos del Trabajo 2025

> ⚠️ This formula changed significantly in 2025 (Ley 5/2025) vs prior years. The TASKS.md file contains the old 2024 formula — use this section instead.

**Eligibility conditions (both must be met):**
- Net work income (`rendimientoNetoTrabajo`) < €19,747.50
- Other non-exempt income < €6,500

**Reduction schedule:**

| Net Work Income | Reduction |
|---|---|
| ≤ €14,852 | **€7,302** |
| €14,852 to €17,673.52 | €7,302 − [1.75 × (RNT − €14,852)] |
| €17,673.52 to €19,747.50 | €2,364.34 − [1.14 × (RNT − €17,673.52)] |
| > €19,747.50 | **€0** (no reduction) |

**Constraint:** The resulting `rendimientoNetoReducido` cannot be negative.

**Formula in code (pseudocode):**
```
rnt = rendimientoNetoTrabajo  // after gastos deducibles (€2,000 minimum)
if rnt <= 14852:
    reduccion = 7302
elif rnt <= 17673.52:
    reduccion = 7302 - 1.75 * (rnt - 14852)
elif rnt < 19747.50:
    reduccion = 2364.34 - 1.14 * (rnt - 17673.52)
else:
    reduccion = 0
rendimientoNetoReducido = max(0, rnt - reduccion)
```

**Gastos deducibles previos** (applied before the reduction above):
- €2,000 flat deduction for all workers (gasto general)
- Additional €2,000 if unemployed and accepted new job requiring relocation
- Additional €3,500 if disability grade 33–64%
- Additional €7,750 if disability grade ≥65% or needing third-party assistance

---

## 5. Deducción por Rendimientos del Trabajo (from cuota — new 2025)

Separate from the base reduction above. This is a **deduction from the cuota líquida** (not from the base):

| Rendimientos del trabajo | Deduction |
|---|---|
| ≤ €16,576 | **€340** |
| €16,576 to €18,276 | €340 − [0.2 × (rendimientos − €16,576)] |
| > €18,276 | **€0** |

This was introduced to protect workers near the Salario Mínimo Interprofesional (SMI).

---

## 6. Mínimo Personal y Familiar 2025

### Mínimo del Contribuyente

| Age | Amount |
|---|---|
| General (< 65 years) | **€5,550** |
| ≥ 65 years | **€6,700** (€5,550 + €1,150) |
| ≥ 75 years | **€8,100** (€6,700 + €1,400) |

### Mínimo por Descendientes
Applies per child/dependent under 25 (or any age if disabled) who lives with the taxpayer and has income < €8,000/year:

| Descendant | Amount |
|---|---|
| 1st child | **€2,400** |
| 2nd child | **€2,700** |
| 3rd child | **€4,000** |
| 4th child and beyond | **€4,500** each |
| **Supplement if under 3 years old** | **+€2,800** per child |

> Example: 2 children, one under 3 → €2,400 + €2,700 + €2,800 = €7,900

### Mínimo por Ascendientes
Applies per parent/grandparent over 65 (or disabled) who lives with the taxpayer at least 6 months/year and has income < €8,000/year:

| Age | Amount |
|---|---|
| ≥ 65 years | **€1,150** |
| ≥ 75 years | **€1,150 + €1,400 = €2,550** |

### Mínimo por Discapacidad

**Of the contributor:**
| Disability grade | Amount |
|---|---|
| 33–64% | **€3,000** |
| 33–64% + needs third-party assistance | **€3,000 + €3,000 = €6,000** |
| ≥ 65% | **€9,000** |
| ≥ 65% + needs third-party assistance | **€9,000 + €3,000 = €12,000** |

**Of ascendants or descendants:**
Same scale as above — €3,000 / €6,000 / €9,000 / €12,000 per person.

### How the Minimum Is Applied
The mínimo personal y familiar does **not** reduce the base directly. Instead:
1. Apply the **state tarifa** to `minimumPersonalFamiliar` → `cuotaMínimoEstatal`
2. Apply the **regional tarifa** to `minimumPersonalFamiliar` → `cuotaMínimoAutonomica`
3. Subtract each from the corresponding cuota íntegra:
   - `cuotaLiquidaEstatal = cuotaIntegraEstatal − cuotaMínimoEstatal`
   - `cuotaLiquidaAutonomica = cuotaIntegraAutonomica − cuotaMínimoAutonomica`
4. Neither can go below **zero**.

---

## 7. Key Exemptions and Exclusions (Rentas Exentas)

These income types are **not included** in the base imponible. The engine must subtract them from gross income before calculating:

| Concept | Limit |
|---|---|
| Severance pay (indemnización por despido) | Up to €180,000 (statutory minimum) |
| Scholarship income (becas públicas) | Up to official limits |
| Incapacidad permanente absoluta / gran invalidez pension | Fully exempt |
| Maternidad / paternidad benefit | Fully exempt |
| Income below filing threshold | Single payer ≤ €22,000 / multiple payers ≤ €15,000 → no obligation to file |
| SMI workers | Effective exemption via trabajo reduction + deduction above |
| Prizes (lotería, ONCE) | Up to €40,000 exempt; above taxed at 20% |

---

## 8. Régimen Foral — Navarra and País Vasco

> ⚠️ These territories use **completely different tax legislation**. The calculation logic, brackets, and minimums are all different. MVP Phase 3 scope.

### Navarra (Impuesto sobre la Renta de las Personas Físicas — IRPF Foral)
Navarra manages its own tax authority. Key differences:
- **11 brackets** (vs 6 state + regional in common regime)
- No state/regional split — single unified tarifa
- Different mínimo personal y familiar amounts

| From (€) | To (€) | Rate |
|---|---|---|
| 0 | 4,458 | 13.0% |
| 4,458 | 10,030 | 22.0% |
| 10,030 | 21,175 | 25.0% |
| 21,175 | 35,663 | 28.0% |
| 35,663 | 51,266 | 36.5% |
| 51,266 | 66,869 | 41.5% |
| 66,869 | 89,159 | 44.0% |
| 89,159 | 139,310 | 47.0% |
| 139,310 | 195,034 | 49.0% |
| 195,034 | 334,344 | 50.5% |
| 334,344 | ∞ | 52.0% |

### País Vasco — Régimen Foral (3 territories)
Each of Bizkaia, Gipuzkoa, and Álava has its own **Diputación Foral** that sets its own IRPF rates. They broadly range from 0% to 49% across ~8 brackets but differ in thresholds. Top combined rate ≈ 49%.

**Engine implementation note:** For `navarra` and `pais-vasco`, the calculator must:
1. Use a single unified tarifa (no state/regional split)
2. Load the appropriate foral rules JSON
3. Apply different reduction and minimum formulas per foral legislation

**Status:** Defer to Phase 3. For Phase 0–2, return a `501 Not Implemented` response with the message: `"Las comunidades forales (Navarra y País Vasco) estarán disponibles próximamente."`

---

## 9. Filing Obligation Thresholds 2025

A taxpayer is **not required** to file if:
- Single payer, gross work income ≤ **€22,000**
- Multiple payers, gross work income ≤ **€15,000** (or second payer paid < €1,500)
- No work income, only investment income ≤ **€1,600**
- No work income, only bank interest or dividends ≤ **€1,600** and capital gains ≤ **€500**

Note: Not being required to file ≠ not beneficial to file. Workers with refunds should always file.

---

## 10. Engine JSON Schema — Updated for 2025

All regional JSON files in `engine/rules/2025/` must follow this schema:

```json
{
  "region": "madrid",
  "fiscalYear": 2025,
  "autonomicBrackets": [
    { "from": 0, "to": 13362, "rate": 0.085 },
    { "from": 13362, "to": 18004, "rate": 0.107 },
    { "from": 18004, "to": 35425, "rate": 0.128 },
    { "from": 35425, "to": 57320, "rate": 0.174 },
    { "from": 57320, "to": null, "rate": 0.205 }
  ],
  "trabajoReductions": {
    "gastoFlatDeduction": 2000,
    "fullReductionThreshold": 14852,
    "maxReduction": 7302,
    "phaseOutSegment1End": 17673.52,
    "phaseOutRate1": 1.75,
    "phaseOutSegment2End": 19747.50,
    "phaseOutRate2": 1.14,
    "segment2BaseReduction": 2364.34
  },
  "cuotaDeduction": {
    "fullDeductionThreshold": 16576,
    "maxDeduction": 340,
    "phaseOutEnd": 18276,
    "phaseOutRate": 0.2
  }
}
```

The `state.json` file for 2025 follows the same structure with `"region": "state"` and `stateBrackets` instead of `autonomicBrackets`.

---

## 11. 2024 vs 2025 Key Differences

| Concept | 2024 | 2025 |
|---|---|---|
| Max trabajo reduction | €5,565 | **€7,302** |
| Full reduction threshold | €14,852 | €14,852 (same) |
| Phase-out end | €19,747 | €19,747.50 (same) |
| Phase-out formula | 1-segment | **2-segment** |
| Cuota deduction for low earners | None | **€340 (new)** |
| Madrid autonomic top bracket | 20.5% (same) | 20.5% |
| Cataluña autonomic top bracket | 25.5% (same) | 25.5% |

> The CLAUDE.md and original TASKS.md files were written for 2024. When building the 2025 engine (current fiscal year), use the formulas and JSON schema in **this file**.

---

## 12. Parity Test Reference Values

Use these to validate the engine against Agencia Tributaria's official simulator at `https://sede.agenciatributaria.gob.es/Sede/declaracion-anual/renta-2025.html`

Run each through the AT simulator and record the exact `cuota_total` and `resultado` to use as expected values in tests. Key profiles to test:

| Profile | Region | Age | Salary | Retenciones | Civil | Deps |
|---|---|---|---|---|---|---|
| Young single Madrid | madrid | 28 | €25,000 | €3,000 | single | 0 |
| Family Cataluña | catalonia | 38 | €45,000 | €8,000 | married | 2 (<25) |
| Senior Madrid | madrid | 67 | €20,000 | €1,200 | single | 0 |
| High earner Valencia | valenciana | 45 | €90,000 | €35,000 | single | 0 |
| Low earner Castilla y León | castilla-leon | 30 | €16,000 | €1,800 | single | 0 |
| Disabled Andalucía | andalusia | 42 | €30,000 | €4,500 | single | 0, disc 65% |

---

## Sources
- [Agencia Tributaria — Manual Renta 2025 (Fase 3 reducción trabajo)](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c03-rendimientos-trabajo/rendimiento-neto-trabajo-integrar-base-imponible/fase-3-determinacion-rendimiento-neto-reducido.html)
- [Agencia Tributaria — Mínimo Personal y Familiar](https://sede.agenciatributaria.gob.es/Sede/ciudadanos-familias-personas-discapacidad/minimo-personal-familiar.html)
- [Agencia Tributaria — Deducciones Autonómicas 2025](https://sede.agenciatributaria.gob.es/Sede/Ayuda/25Manual/100/deducciones-autonomicas.html)
- [TaxDown — Tablas y tramos del IRPF 2026](https://taxdown.es/irpf/tabla-tramos)
- [Idealista — Tablas IRPF 2026](https://www.idealista.com/news/fiscalidad/2026/04/19/891670-tablas-y-tramos-del-irpf-2026-cuales-son-y-como-funcionan)
- [SuperContable — Mínimos Personales y Familiares](https://www.supercontable.com/informacion/impuesto_renta_IRPF/Minimos_personales_y_familiares_del_IRPF.html)
- [Wolters Kluwer — Retenciones IRPF 2025](https://www.wolterskluwer.com/es-es/expert-insights/tramos-retenciones-irpf-2025-novedades)
