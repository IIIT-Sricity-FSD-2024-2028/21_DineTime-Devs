# 21_Dinetime_devs_FDFED_REACT

## Folder structure

The React application lives in `React_frontend/`. Its source is organized around the different parts of the DineTime experience: a landing page and separate interfaces for diners, restaurant staff, managers, and administrators.

```text
.
├── README.md
└── React_frontend/
    ├── index.html                 # Vite page entry point
    ├── package.json               # Dependencies and development scripts
    ├── vite.config.js              # Vite configuration
    ├── public/
    │   └── assets/                # Static images and other public assets
    └── src/
        ├── main.jsx               # Starts the React application
        ├── app/
        │   └── App.jsx            # Selects an interface based on the URL
        ├── styles/
        │   └── global.css         # Shared global styles
        └── apps/
            ├── landing/           # Public home page
            ├── diner/             # Diner browsing, ordering, and reservations
            ├── restaurant-staff/  # Restaurant staff interface
            ├── manager/           # Restaurant manager interface
            ├── sub-admin/         # Sub-administrator interface
            └── super-admin/       # Super-administrator interface
```

### What is inside `src/apps/`

Each role folder keeps its own application code together. Depending on the role, it may contain:

- `app/` — the role's top-level React application and navigation.
- `pages/` — full screens or routes.
- `components/` — reusable pieces of that role's interface.
- `api/` — functions for communicating with backend services.
- `styles/` — role-specific CSS.
- `hooks/`, `context/`, and `utils/` — shared state, React hooks, formatting, and other helpers.
- `assets/` or `utils/images/` — images used by that interface.

The folders vary by role, so not every role has every subfolder. `src/app/App.jsx` chooses which role application to show using the first URL segment. The landing page is shown at `/`; paths beginning with `/diner`, `/restaurant-staff`, `/manager`, `/sub-admin`, or `/super-admin` load their corresponding interfaces.
