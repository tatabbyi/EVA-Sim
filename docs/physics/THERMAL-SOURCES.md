# Thermal model — source and claim register

**Date:** 2026-11-15. References are primary publications; use only the statements they establish. This registry complements the existing `NASA-DATA-AND-PRIMARY-SOURCES.md`.

| ID | Reference | Actual relevance / limitations |
| --- | --- | --- |
| TH-N01 | Anderson, M. S., Ewert, M. K., Keener, J. F. (2018), *Life Support Baseline Values and Assumptions Document*, NASA/TP-2015-218570/REV1, NTRS 20180001338, https://ntrs.nasa.gov/citations/20180001338 , PDF https://ntrs.nasa.gov/api/citations/20180001338/downloads/20180001338.pdf | EVA PLSS thermal architecture; LCVG coolant heat transport from human to PLSS; Table 4-76 example 293 W metabolic demand and 75 g O2/h. NOT a calibrated Mars suit thermal profile. |
| TH-N02 | Marsch, R. F. et al. (2024), *Analytical Review of Exploration Extravehicular Mobility Unit Heat Rejection Performance*, ICES-2024-122, NTRS 20240004206, https://ntrs.nasa.gov/citations/20240004206 | xEMU PTCL/ATCL and their thermal-vacuum testing, primary 0–900 W / auxiliary 0–300 W experimental ranges. **Test envelope is NOT the nominal cooling rating of our invented suit.** |
| TH-N03 | NASA-STD-3001 Vol 2 Rev F (2026-07-14), §11.1.4.5 [V2 11011], https://standards.nasa.gov/standard/NASA/NASA-STD-3001_VOL_2 | Nominal human heat-storage constraint assessed via 41-Node Man or Wissler thermoregulation model. Our 4-node thermal model cannot certify this requirement or medical safety. |
| TH-N04 | Miller, T. R. et al. (2010), *Dynamic Simulation of Human Thermoregulation and Heat Transfer for Spaceflight Applications*, NTRS 20100039626, https://ntrs.nasa.gov/citations/20100039626 | Compartmental human thermal response and validation context; NOT calibration of current four-node suit. |
| TH-N05 | Parker, J. F. and West, V. R. (eds.) (1973), *Bioastronautics Data Book*, NASA SP-3006, NTRS 19730006364, https://ntrs.nasa.gov/citations/19730006364 | Research precedent for human core/skin separation; not equivalent to implementing complete Gagge physiology. |
| TH-N06 | Swartout, B. et al. (2024), *xEMU Chamber B Thermal Vacuum Suit 2 Pressure Garment System Test Article Results*, NTRS 20240004548, https://ntrs.nasa.gov/citations/20240004548 | Suit thermal-vacuum test measurements; potential future suit thermal calibration, but effective coefficients not yet extracted. |
| TH-N07 | NASA/TM-20220006678 (2022), §4.2.4.1 Mars Environment, https://ntrs.nasa.gov/api/citations/20220006678/downloads/TM-20220006678.pdf | Thin CO2 atmosphere, radiative exchange and finite low-pressure heat transfer; does not supply coefficients for this scene. |
| TH-N08 | Mars 2020 MEDA, NASA PDS Atmospheres Node, https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html , DOI 10.17189/1522849 | Archived weather, atmospheric and radiative observations. **No site/sol-selected product imported for Rachel's new landing site.** |
| TH-C01 | NIST/CODATA Stefan–Boltzmann constant, https://physics.nist.gov/cgi-bin/cuu/Value?sigma | Exact `sigma=5.670374419e-8 W/(m^2 K^4)`. |
| TH-M01 | Conservation of energy / thermal-capacitance network | Governing physical identities are rigorous; effective conductances and capacities need empirical identification. |

## Provenance states

- **NASA-OBS:** exact instrument reading with product version/site/sol/quality flags.
- **NASA-REF:** engineering research baseline or tested prototype, not a site-specific observation.
- **DERIVED:** SI physical equation or documented calculation.
- **ENGINEERING-ASSUMPTION:** transparent hypothetical Mars suit/conditions, **not measured**.
- **UNKNOWN:** value unavailable; do not pretend otherwise.

The isolated thermal-test fixture's human node heat capacities, conductances, coolant inlet, shell effective areas/coatings, 400 W/m2 solar input, −60°C air, 200 K radiative background, and cooling capacity are **ENGINEERING-ASSUMPTIONS**. All need real measurements or documented uncertainty before scientific certification. Their example trace is useful for testing equations but cannot predict a real NASA astronaut. Do not cite any numeric "safe temperature" threshold from the 4-node model.