# 🎼 **PRODUCT SPECIFICATION**

## **Working Title:** *ScalePad Chord Creator*

## **Category:** Browser-based MIDI + in-browser synthesizer instrument

## **Core Concept:**

A mouse- and keyboard-driven musical controller that allows users to create harmonically correct chords within a selected musical scale using minimal controls:

- **7 root-degree keys**
- **1 radial “chord wheel” controlled by mouse movement**
- **1–5 extension/color buttons**

No musical knowledge is required for the user to produce pleasing, in-scale chords.

---

# 1. **Product Objectives**

### Primary Goals

- Provide a simple, intuitive interface for building chords without theoretical knowledge.
- Guarantee musically correct (scale-locked) output at all times.
- Allow immediate musical play via keyboard + mouse.
- Output sound directly via an internal synthesizer.
- Output MIDI data to external devices or DAWs when available.

### Secondary Goals

- Be visually instructive for learning chord behavior.
- Support creative workflows including songwriting, live experimentation, and finger-drumming-style chord jams.
- Operate entirely within a browser environment without mandatory installation.

---

# 2. **Target Users**

1. **Beginner musicians** wanting a “no wrong notes” environment.
2. **Producers/composers** who want quick harmonic sketching.
3. **Performers** who want a simple controller for chord triggering.
4. **Educators** demonstrating chord qualities visually and audibly.

---

# 3. **Core Features Overview**

### 3.1 Root Selection (Keyboard)

- 7 physical keys chosen (default: `A` through `G`) represent **scale degrees 1–7**.
- Pressing a root key outputs a chord whose:
    - Root is the selected scale degree’s note.
    - Quality is determined by the chord wheel.
    - Extensions are determined by the extension mode.
- Always diatonic based on current scale.

### 3.2 Chord Quality Selection (Mouse on Radial Wheel)

An 8-segment radial interface on screen, controlled by mouse movement.

Default chord-wheel layout:

```
        Maj7
   Major      Dom7
Dim               Sus4
   Minor      Min7
        Sus2

```

Each segment corresponds to a chord quality.

Mouse behavior:

- Hover selects chord quality.
- Clicking may “lock in” a quality (optional).
- Cursor position is continuously interpreted if “Hover Mode” is enabled.

### 3.3 Extensions / Colors (Number Keys)

Keys `1–5` modify chord complexity:

| Key | Function |
| --- | --- |
| 1 | Base triad |
| 2 | 7th chord |
| 3 | Add 9 |
| 4 | 9 + 11 (diatonic voicing) |
| 5 | 9 + 11 + 13 (lush/full extension) |

Rules:

- Extensions are always diatonic.
- Extensions conform to the selected chord quality (e.g., Dom9, Min11).

### 3.4 Internal Synthesizer

- Implemented via Web Audio API (or equivalent).
- Default patch: warm polysynth (simple saw+sine combination).
- Features:
    - ADSR envelope
    - Low-pass filter
    - Velocity sensitivity (if desired)
    - One voice per chord tone (polyphonic)

### 3.5 MIDI Output (Optional)

System attempts Web MIDI connection if browser supports it.

Capabilities:

- Enumerate available MIDI output ports.
- Send:
    - Note On/Off
    - Note velocity
    - Optional CC data (for color level, quality changes, etc.)

Fallback:

- If Web MIDI unavailable, device silently disables MIDI and uses internal synth.

---

# 4. **Musical Logic Specification**

### 4.1 Scale Structure

Scale selection consists of:

- **Root key dropdown** (C, C#, D, …)
- **Scale type dropdown**:
    - Major
    - Natural minor
    - Dorian
    - Mixolydian
    - Lydian
    - Phrygian
    - Aeolian
    - Locrian
        
        (You can reduce or expand based on product requirements.)
        

### 4.2 Root Note Mappings

Scale degree bindings:

- Degree 1 → keyboard key `A`
- Degree 2 → `S`
- Degree 3 → `D`
- Degree 4 → `F`
- Degree 5 → `G`
- Degree 6 → `H`
- Degree 7 → `J`

UI labels always show the *musical note* assigned to each.

### 4.3 Chord Quality Definitions

Each chord type is defined as:

- A root (based on scale degree)
- A chord formula (scale-degree-relative)
- A voicing pattern

Example:

**Major chord** = degrees {1, 3, 5}

**Min7 chord** = {1, ♭3, 5, ♭7} (interpreted relative to scale)

### 4.4 Voicing Rules

- All notes are computed from the scale, not chromatically.
- Voicings should be:
    - Spread enough to avoid mud (e.g., use closed voicing + octave displacement).
    - Stable/consistent across chord types.
- Optional: implement voice-leading (keep common tones in place).

### 4.5 Extensions

Extensions are mapped to scale degrees:

- 9 = scale degree 2 (one octave higher)
- 11 = scale degree 4
- 13 = scale degree 6

Logic ensures diatonic correctness.

---

# 5. **User Interface Specification**

### 5.1 Layout

- Top area: key selector dropdowns.
- Middle: large chord wheel.
- Bottom: scale-degree keyboard (visual representation).
- Corner/side: extension levels indicated visually.
- Live display: shows currently playing chord name.

### 5.2 Interaction Modes

### Cursor Interaction

- Hover selects chord quality.
- Click toggles “locked” mode.

### Keyboard Interaction

- Root-degree keys trigger chords.
- Extensions (1–5) modify state.
- Escape (or another key) resets to default.

---

# 6. **System Architecture (Framework Agnostic)**

### 6.1 Functional Modules

1. **Input Handler**
    - Keyboard events
    - Mouse position / click events
    - UI element changes
2. **Music Engine**
    - Scale computation
    - Chord construction
    - Voicing generation
    - Extension rules
    - Voice-leading (optional)
3. **Audio Engine**
    - Synth voice allocation
    - Envelope and filter modules
    - Polyphonic note scheduling
4. **MIDI Output Manager**
    - Detect Web MIDI support
    - Enumerate devices
    - Send note events
    - Handle fallback gracefully
5. **UI Renderer**
    - Radial chord wheel
    - Note labels
    - Color/extension visualization
    - Real-time state indicators
6. **State Manager**
    - Current key
    - Current scale
    - Current chord quality
    - Extension/cycle level
    - Locked/hover modes

### 6.2 Platform Considerations

- Should function on:
    - Desktop Chrome/Chromium (full feature set)

	ok