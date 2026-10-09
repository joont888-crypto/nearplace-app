# NearPlace Luxe --- Design System

## 1. Design Direction

NearPlace Luxe is a premium mobile-first smart location assistant.

The visual language is based on:

-   Soft Neumorphism
-   Minimal Luxury
-   Monochromatic warm-neutral UI
-   Apple-inspired minimalism
-   Physical-product interface
-   Raised and recessed surfaces
-   Ultra-soft shadows
-   Large rounded corners
-   Generous negative space
-   Thin, elegant typography

### Core visual principle

The entire interface should feel like one premium physical object made
from a soft material.

UI elements should appear either:

-   **Raised** from the surface
-   **Recessed** into the surface

Avoid making the application look like a conventional dashboard.

Do not use heavy glassmorphism, strong gradients, hard shadows,
excessive borders, or highly saturated colors.

------------------------------------------------------------------------

## 2. Reference Design

Use the provided reference image as the primary visual inspiration.

Reproduce its **design language**, not its exact content.

Important characteristics:

-   Warm monochromatic gray palette
-   Very soft lighting
-   Large rounded containers
-   Neumorphic depth
-   Raised buttons
-   Recessed controls
-   Thin typography
-   Minimal icons
-   Floating UI
-   Large negative space
-   Calm and premium appearance

------------------------------------------------------------------------

## 3. Color System

### Light Mode

  Token                 Color                   Usage
  --------------------- ----------------------- -----------------------------
  `background`          `#E5E3E0`               Main application background
  `surface`             `#E9E7E4`               Raised surfaces
  `surface-recessed`    `#DCDAD7`               Recessed controls
  `surface-highlight`   `#F2F0ED`               Soft highlights
  `text-primary`        `#222222`               Main text
  `text-secondary`      `#777777`               Secondary text
  `text-muted`          `#999999`               Supporting information
  `accent`              Champagne / warm gray   Subtle emphasis

The interface should remain almost monochromatic.

Use color only when necessary for:

-   Weather conditions
-   Warnings
-   Success states
-   Navigation state
-   Important alerts

Colors must remain muted and sophisticated.

### Dark Mode

Use a graphite / charcoal palette.

Example:

  Token                Color
  -------------------- -----------
  `background`         `#242321`
  `surface`            `#2C2A28`
  `surface-recessed`   `#1F1E1C`
  `text-primary`       `#F1EFEC`
  `text-secondary`     `#AAA6A0`
  `text-muted`         `#77736D`

Dark mode must use proper neumorphic lighting instead of simply
inverting colors.

------------------------------------------------------------------------

## 4. Neumorphic Lighting

### Raised Surface

Use soft directional shadows.

``` css
box-shadow:
  10px 10px 25px rgba(150, 150, 150, 0.18),
  -10px -10px 25px rgba(255, 255, 255, 0.75);
```

### Recessed Surface

Use inner shadows.

``` css
box-shadow:
  inset 6px 6px 14px rgba(150, 150, 150, 0.16),
  inset -6px -6px 14px rgba(255, 255, 255, 0.65);
```

Shadows must be:

-   Soft
-   Diffused
-   Low contrast
-   Natural
-   Consistent

Avoid hard drop shadows.

------------------------------------------------------------------------

## 5. Shape Language

Use generous rounded corners throughout the application.

Recommended radius:

``` text
Small controls:       16–20px
Buttons:              20–28px
Cards:                28–36px
Large containers:     36–44px
Bottom navigation:    30–40px
Circular controls:    50%
```

The UI should feel soft and organic rather than sharp or technical.

------------------------------------------------------------------------

## 6. Typography

Use a modern clean sans-serif font.

Recommended characteristics:

-   Light
-   Thin
-   Minimal
-   Spacious
-   High readability

Use large numbers as visual anchors.

Examples:

``` text
28°
4.8 km
18 min
฿1,500
```

Avoid excessive bold typography.

Suggested hierarchy:

``` text
Display:       32–42px
Heading:       22–28px
Subheading:    16–18px
Body:          14–16px
Caption:       11–13px
```

Use generous line height and letter spacing.

------------------------------------------------------------------------

## 7. Iconography

Use simple thin-line icons.

Preferred styles:

-   Lucide
-   Phosphor
-   SF Symbols-inspired

Icons should be:

-   Thin
-   Rounded
-   Minimal
-   Monochromatic

Avoid colorful or complex icons.

------------------------------------------------------------------------

## 8. Mobile Layout

Primary target:

``` text
9:16 portrait
```

Support common mobile sizes:

``` text
390 × 844
393 × 852
412 × 915
430 × 932
```

Maximum content width:

``` text
430px
```

Use generous spacing and avoid horizontal scrolling.

### General layout

``` text
┌──────────────────────────┐
│ Header                   │
│                          │
│ Main location card       │
│                          │
│ Destination              │
│                          │
│ Weather / Travel info    │
│                          │
│ Quick actions             │
│                          │
│                          │
│ Floating bottom nav      │
└──────────────────────────┘
```

Negative space is an important part of the design.

------------------------------------------------------------------------

# 9. Application Navigation

Main screens:

1.  Home
2.  Explore
3.  Place Details
4.  Map / Navigation
5.  Budget
6.  History
7.  Favorites
8.  Settings

Bottom navigation:

``` text
Home
Explore
Map
Budget
Profile
```

The bottom navigation must be a floating neumorphic capsule.

------------------------------------------------------------------------

# 10. Home Screen

The Home screen is the primary experience.

### Header

Display:

-   Date / greeting
-   EN / TH language switch
-   Light / Dark mode control

Controls should use circular neumorphic buttons.

### Main Search

Primary text:

> Where do you want to go?

Show:

``` text
Current Location
Bangkok

Destination
Select a place
```

The search field should appear recessed into the surface.

------------------------------------------------------------------------

# 11. Destination Card

Display:

-   Place image
-   Place name
-   Category
-   Favorite button
-   Distance
-   Travel time

Example:

``` text
ICONSIAM
Shopping Mall

4.8 km
18 min
```

The image should use a large rounded rectangle.

The favorite button should overlap the image as a circular neumorphic
control.

------------------------------------------------------------------------

# 12. Map Design

Use Mapbox for maps.

The map should visually integrate with the monochromatic UI.

Avoid a highly colorful map if a neutral map style is available.

Display:

-   Current location
-   Destination
-   Route
-   Distance
-   Travel time

Travel modes:

``` text
🚶 Walk
🚗 Car
```

The selected mode should appear recessed.

------------------------------------------------------------------------

# 13. Travel Information

Display:

``` text
Distance
4.8 km

Time
18 min

Steps
6,200

Calories
285 kcal
```

Use a clean 2×2 or horizontal arrangement.

Do not create traditional colorful dashboard cards.

Use subtle raised/recessed surfaces.

------------------------------------------------------------------------

# 14. Weather

Use Open-Meteo.

Display:

``` text
28°
Partly Cloudy

Rain
20%

Wind
12 km/h

Humidity
74%
```

Weather should appear as a soft physical panel.

Keep icons minimal and monochromatic.

------------------------------------------------------------------------

# 15. Proximity Alert

Users can select a destination and define a notification radius.

Available radius:

``` text
100 m
250 m
500 m
1 km
2 km
```

Display the selected radius using a circular/radial control.

Example:

``` text
Notify me when I am near

ICONSIAM

500 m
```

When the user enters the configured radius:

-   Trigger notification
-   Play sound where supported
-   Show in-app alert

Example:

> You are near ICONSIAM.

The implementation should be structured so native background-location
services can be added later for reliable mobile geofencing.

------------------------------------------------------------------------

# 16. Budget System

Users can define a budget for each destination.

Example:

``` text
ICONSIAM

Budget
฿1,500

Spent
฿850

Remaining
฿650
```

Features:

-   Set budget
-   Add expense
-   Calculate remaining budget
-   View spending history
-   View total spending
-   View destination-specific spending

Use large elegant numbers.

Do not use a conventional banking-dashboard aesthetic.

------------------------------------------------------------------------

# 17. Budget Screen

Main display:

``` text
฿1,500
Budget

฿850
Spent

฿650
Remaining
```

Include:

-   Add Expense
-   Expense History
-   Destination History

The interface should remain monochromatic and minimal.

------------------------------------------------------------------------

# 18. Place Details

Place details should contain:

-   Large place image
-   Place name
-   Category
-   Favorite
-   Address
-   Opening hours
-   Weather
-   Distance
-   Estimated travel time
-   Walking route
-   Car route
-   Budget
-   Proximity alert

Primary actions:

``` text
Start Navigation
Set Alert
Add Budget
Favorite
```

------------------------------------------------------------------------

# 19. Favorites

Display saved locations as compact elegant cards.

Example:

``` text
♡ ICONSIAM
♡ Siam Paragon
♡ CentralWorld
```

Keep cards minimal and spacious.

------------------------------------------------------------------------

# 20. History

Display recent activity.

Example:

``` text
Today
ICONSIAM
4.8 km
฿850

Yesterday
Siam Paragon
3.2 km
฿420
```

Use subtle separators.

------------------------------------------------------------------------

# 21. Settings

Settings include:

### Appearance

``` text
Light
Dark
```

### Language

``` text
EN
TH
```

### Units

``` text
km / mi
°C / °F
```

### Notifications

``` text
Proximity Alerts
Sound
```

### Location

``` text
Location Permission
```

### About

Application information and version.

------------------------------------------------------------------------

# 22. Language Support

Support:

``` text
English
Thai
```

Use a simple:

``` text
EN / TH
```

toggle.

All UI strings must be translatable.

Examples:

  English                    Thai
  -------------------------- -----------------
  Home                       หน้าหลัก
  Explore                    สำรวจ
  Map                        แผนที่
  Budget                     งบประมาณ
  Settings                   ตั้งค่า
  Where do you want to go?   คุณต้องการไปที่ไหน?
  Start Navigation           เริ่มนำทาง
  Set Alert                  ตั้งค่าการแจ้งเตือน

------------------------------------------------------------------------

# 23. Light / Dark Mode

Theme switching must work globally.

### Light

Warm gray / ivory neumorphic environment.

### Dark

Graphite / charcoal neumorphic environment.

Do not simply invert the colors.

Shadows and highlights must change appropriately for each theme.

------------------------------------------------------------------------

# 24. Interaction Design

Interactions should feel physical.

### Button Press

When pressed:

``` css
transform: scale(0.97);
```

Change from:

``` text
Raised
```

to:

``` text
Recessed
```

Use smooth transitions:

``` text
150–250ms
```

Avoid excessive animation.

------------------------------------------------------------------------

# 25. Component Rules

All components should follow the same physical-material language.

Components include:

-   NeumorphicButton
-   NeumorphicCard
-   RecessedInput
-   CircularControl
-   FloatingNavigation
-   PlaceCard
-   WeatherCard
-   TravelSummary
-   BudgetCard
-   AlertControl
-   MapPanel
-   Toggle
-   Modal
-   BottomSheet

Components must be reusable.

------------------------------------------------------------------------

# 26. Buttons

Primary buttons should be rounded and soft.

Example:

``` text
┌────────────────────────┐
│   Start Navigation     │
└────────────────────────┘
```

Buttons should appear physically raised.

Secondary controls can be circular:

``` text
   ◯
  Map
```

------------------------------------------------------------------------

# 27. Bottom Navigation

Use a floating capsule.

Example:

``` text
╭──────────────────────────────╮
│  Home  Explore  Map  Budget  │
╰──────────────────────────────╯
```

The active item should appear slightly recessed.

Do not use a standard fixed rectangular navigation bar.

------------------------------------------------------------------------

# 28. Maps and API

### Map

Use:

``` text
Mapbox
```

The Mapbox token must be supplied through environment configuration.

Never hard-code secret credentials directly into reusable source code.

### Weather

Use:

``` text
Open-Meteo
```

No API key should be required for normal Open-Meteo usage.

### Location

Use:

``` text
Browser Geolocation API
```

### Notifications

Use:

``` text
Web Notifications API
```

where supported.

For production mobile applications, allow the architecture to be
extended with native notification and background-location capabilities.

------------------------------------------------------------------------

# 29. Data Persistence

Persist user preferences and local application data.

Store:

-   Theme preference
-   Language preference
-   Favorite places
-   Selected travel mode
-   Budget
-   Expenses
-   Alert radius
-   Recent destinations

For a prototype, local storage is acceptable.

For production, use a backend/database such as Firebase if required.

------------------------------------------------------------------------

# 30. Responsive Behavior

The design must remain visually consistent across mobile sizes.

Do not allow:

-   Horizontal scrolling
-   Overlapping content
-   Text clipping
-   Buttons becoming too small
-   Excessively dense layouts

Prioritize:

``` text
Spacing
Readability
Touch targets
Visual hierarchy
```

------------------------------------------------------------------------

# 31. Accessibility

Touch targets should generally be at least:

``` text
44 × 44px
```

Maintain sufficient text contrast while preserving the soft visual
style.

Do not rely only on color to communicate state.

------------------------------------------------------------------------

# 32. Visual Quality Rules

The application should feel:

-   Elegant
-   Calm
-   Premium
-   Soft
-   Minimal
-   Futuristic
-   Professional

Avoid:

-   Bright gradients
-   Neon colors
-   Hard shadows
-   Excessive glass effects
-   Excessive borders
-   Dense dashboards
-   Tiny controls
-   Excessive animations
-   Unnecessary decorations

------------------------------------------------------------------------

# 33. Final Visual Target

The final result should resemble:

> Apple-inspired minimalism + premium hardware + soft neumorphism +
> luxury travel assistant.

The user should feel that the interface is a physical premium device
rather than a conventional website.

The most important visual priorities are:

1.  Soft neumorphic depth
2.  Warm monochromatic colors
3.  Large rounded shapes
4.  Minimal typography
5.  Physical raised/recessed controls
6.  Generous negative space
7.  Floating navigation
8.  Consistent lighting
9.  Elegant mobile composition
10. Functional interactions

------------------------------------------------------------------------

# 34. Design Keywords

Use these keywords when generating or extending the UI:

``` text
Soft Neumorphism
Minimal Luxury
Monochromatic
Warm Neutral
Apple-inspired
Physical Object UI
Raised Surface
Recessed Surface
Ultra Soft Shadows
Large Rounded Corners
Minimal Typography
Floating UI
Premium Mobile UI
Elegant
Calm
Futuristic
Clean
9:16 Portrait
```

------------------------------------------------------------------------

# 35. Implementation Principle

The design system must be treated as a unified visual system.

Do not design each screen independently.

Every screen must share:

-   Same surface color
-   Same lighting direction
-   Same shadow softness
-   Same corner radius language
-   Same typography
-   Same icon style
-   Same spacing system
-   Same interaction behavior

The result must feel like one coherent premium product.
