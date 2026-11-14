# 13 Space Apps rules

Read on 14 Nov 2026 from:
- Project Submission Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging and Awards Guide: https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Participant FAQs: https://www.spaceappschallenge.org/resources/participant-faqs/
- 2026 Participant Terms and Conditions (updated 7 Aug 2026): https://www.spaceappschallenge.org/legal/

The site has an incomplete TLS certificate chain (01); open it in a normal browser.

## Timing

- **The whole hackathon is 14 to 15 Nov 2026 worldwide**, not just Athlone. Submission opens Sat 14 Nov 09:00 and closes Sun 15 Nov 23:59, in the Local Event's time zone.
- "Check with your Local Lead about times for your Local Event's local judging and awards which may differ from the global submission times." So Athlone's Sunday 05:00 feature freeze and 11:30 presentations are local; the online form stays open to 23:59.
- Save often ("Save Progress" button). Turn the edit "Lock" on so two people don't edit the project page at once.

## Project submission form fields

| Field | What to put |
|---|---|
| Project Name | |
| High-Level Project Summary | Short summary |
| Link to Project Demo | Public link to the 30 s video or the slide deck |
| Link to Final Project | Public link: the Vercel site and/or GitHub repo |
| Detailed Project Description | What it does, how it works, benefits, goals, tools and languages used |
| Use of Super Intelligence (SI) | Yes/no and how (see below). Answer is for data collection only; judges don't see it. |
| NASA Data | Specific NASA data and resources used. **At least one is required for a Global Award.** |
| Space Agency Partner Data and Other References | "All of the data, resources, and tools used ... any code, text, and images (even if they are open source or freely available)" |

Uploads: images only (JPG, PNG, GIF, up to 10 MB). **No video or document uploads**; link them instead, publicly, "with no logins, permissions, or registrations required". Test the links in a private browser window.

Tip from the guide: for a new website, request a **Web Filter Classification** so judges' networks don't block it. Worth doing for a fresh `*.vercel.app` address.

"The majority of judges' evaluation will be based on your project submission", not the demo. The demo mainly feeds the Presentation score.

## Demo rules

- **Video of 30 seconds or less, or a slide deck of up to seven slides including title and intro slides.**
- Host externally (YouTube, Google Drive, GitHub, OneDrive, Dropbox...). Can't upload to the Space Apps site.
- **English** on the submission page and all linked material. A video may be spoken in another language but **must have English subtitles**. Slide decks must be in English.
- Guide's advice: decide video or slides early, one person leads it, show the title and a tagline, show the prototype, describe the user's experience, and say how NASA data made it possible.

## AI ("Super Intelligence") disclosure

The 2026 guide calls AI "Super Intelligence (SI)". Word for word where quoted:

- SI tools (machine learning, chatbots, image generation, LLMs) "is permitted".
- "SI should not be used to (come up with your idea of how to solve the challenge)."
- "Generated content may not use, contain, or modify any NASA branding or design elements (such as the NASA logos, flags, or mission identifiers)."
- **Images and videos: "Must include a visible watermark to indicate SI generation."**
- **Audio: "Must acknowledge SI generation in descriptive text and metadata."**
- **Code and data: "Must acknowledge SI generation in descriptive text and metadata."**
- Judges "will evaluate originality, intent, and execution based on the SI-assisted elements you include and identify".

What this means for EVA Sim:
- A line in the Detailed Project Description saying which parts used SI (for example: research help, code assistance).
- A header comment in SI-assisted source files, and a note in the README.
- Any SI-generated image or video frame gets a visible watermark. Screen recordings of the app itself are not SI-generated.
- This overnight research used an AI assistant. Say so in the description.

## Licensing

From the Terms and Conditions:

- **Your original content** must be "freely available without restriction or is licensed as open source as defined by the Open Source Initiative". **"If you do not specify a specific OSI compliant license, NASA will distribute your original content under an Apache 2.0 license."**
- **Third-party code and data** ("Solution Materials") must be "freely and publicly available without restriction or, at a minimum, are also licensed as open source". You must check this yourself before submitting.
- Don't submit: material you don't hold rights to, business-sensitive information, personal data.
- Videos: by submitting you grant the US government a royalty-free, worldwide, perpetual, non-exclusive licence to use them.

Check of the planned stack: three.js, MapLibre, pymartini, scikit-image, SciPy, GDAL, Vite and React are all under OSI licences (MIT, BSD or similar). **mars-date-utils is GPL-3.0**, also OSI-approved, so it's allowed, but then the repo should declare GPL-3.0 (not leave the Apache 2.0 default, which conflicts). Simplest: put a `LICENSE` file in the repo on Saturday morning, and either choose GPL-3.0 or replace mars-date-utils (08).

NASA data and imagery: generally not under US copyright; credit it and don't imply endorsement (09).

## People and images

- "Recognizable names, voices, and likenesses of persons under the age of 18 should not be included in any submission." Applies to the demo video and screenshots.
- No NASA logos, flags or mission identifiers in generated content; the NASA brand rules forbid the insignia generally (09).

## Teams and eligibility

- Local Event teams: at least 1 person. **Maximum 6.** All members registered for the same Local Event, or the team is not eligible for global judging.
- No new members after submission closes.
- Local judging picks the Global Nominees; only those go to global judging.

## Judging criteria (exact definitions)

- **Creativity:** "demonstrates originality and innovation. It introduces a novel concept that has not been attempted before or presents an improvement upon existing ideas in a meaningful way."
- **Validity:** "grounded in scientific principles and demonstrates technical, functional, or logical feasibility ... has the potential to function in real-world applications."
- **Relevance:** "fully and directly addresses the challenge ... meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition."
- Impact and Presentation are the other two; scores 1 to 5.
- Global awards are the ten listed in 12 (Best Use of Science, Best Mission Concept, and so on).

Given 11 (several similar planners), Creativity's "improvement upon existing ideas in a meaningful way" is the realistic target: Survival Odds and the Houston view are the improvement.

## Athlone specifics

The Athlone event page (`/2026/local-events/athlone/`) loads its content by JavaScript and showed nothing useful to a script. The schedule in the brief (feature freeze Sun 05:00, presentations 11:30 to 16:30) could not be confirmed from the site. Ask the Local Lead at kickoff about the local judging format, and whether local presentations use the same 7-slide / 30-second limit.
