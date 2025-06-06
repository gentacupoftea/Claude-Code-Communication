> conea-frontend@0.1.0 cypress:run
> cypress run


DevTools listening on ws://127.0.0.1:42165/devtools/browser/09cab2b7-07ac-4ab0-b6d4-640548859dc3
Missing baseUrl in compilerOptions. tsconfig-paths will be skipped
tput: No value for $TERM and no -T specified

====================================================================================================

  (Run Starting)

  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Cypress:        13.17.0                                                                        │
  │ Browser:        Electron 118 (headless)                                                        │
  │ Node Version:   v20.19.2 (/opt/hostedtoolcache/node/20.19.2/x64/bin/node)                      │
  │ Specs:          9 found (accessibility.cy.ts, api-settings.cy.ts, auth.cy.ts, cache.cy.ts, das │
  │                 hboard.cy.ts, multillm-chat.cy.ts, performance.cy.ts, projects.cy.ts, registra │
  │                 tion.cy.ts)                                                                    │
  │ Searched:       cypress/e2e/**/*.cy.{js,jsx,ts,tsx}                                            │
  │ Experiments:    experimentalStudio=true,experimentalWebKitSupport=true                         │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘


────────────────────────────────────────────────────────────────────────────────────────────────────
                                                                                                    
  Running:  accessibility.cy.ts                                                             (1 of 9)


  Accessibility Tests
    Keyboard Navigation
      (Attempt 1 of 3) should support tab navigation on login page
      (Attempt 2 of 3) should support tab navigation on login page
      1) should support tab navigation on login page
      (Attempt 1 of 3) should support keyboard form submission
      (Attempt 2 of 3) should support keyboard form submission
      2) should support keyboard form submission
      (Attempt 1 of 3) should support escape key for modal dismissal
      (Attempt 2 of 3) should support escape key for modal dismissal
      3) should support escape key for modal dismissal
    Screen Reader Support
      (Attempt 1 of 3) should have proper ARIA labels on form inputs
      (Attempt 2 of 3) should have proper ARIA labels on form inputs
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  api-settings.cy.ts                       12:20       14        -       14        -        - │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  auth.cy.ts                               02:29        5        1        4        -        - │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  cache.cy.ts                              00:11        5        -        5        -        - │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  dashboard.cy.ts                          04:17        5        -        5        -        - │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  multillm-chat.cy.ts                      11:24       13        -       13        -        - │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  performance.cy.ts                        00:36       16        -        1        -       15 │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  projects.cy.ts                           00:47       14        -       14        -        - │
  ├────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ ✖  registration.cy.ts                       00:47       14        -       14        -        - │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘
    ✖  9 of 9 failed (100%)                     39:43      106        5       86        -       15  

Error: Process completed with exit code 86.