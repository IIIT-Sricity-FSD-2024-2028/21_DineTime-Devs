# Summary of the interaction

## Basic information
Domain: Service & Capacity Management System

Problem statement:  Restaurant reservation and capacity management for dine-ins'.

Date of interaction: Requirements elicitation phase

Mode of interaction: Video call

Duration (in-minutes): 31 

Publicly accessible Video link: https://drive.google.com/file/d/1nLGgF40rVxh2r_NYEzeRnJvZJN6H97Ul/view?usp=drivesdk

## Domain Expert Details
Role/ designation:

Software Development Engineer (SDE) / Technical Domain Mentor

Experience in the domain (Brief description of responsibilities and years of experience in domain):

Experience in the restaurant dine-in reservation domain, with an understanding of restaurant operations, seating management, and customer booking practices, and the ability to translate real-world dining workflows into clear system requirements.

Nature of work: Technical


## Domain Context and Terminology
- How would you describe the overall purpose of this problem statement in your daily work?
  To provide a software-based solution that helps restaurants manage reservations and seating efficiently, prevent overbooking, handle no-shows, and support smooth dine-in operations during peak and non-peak hours.


- What are the primary goals or outcomes of this problem statement?
  Accurate reservations, predictable seating capacity, reduced no-shows, faster customer check-in, and better coordination between restaurant staff and management.

- List key terms used by the domain expert and their meanings 

| Term | Meaning as explained by the expert |
|---|---|
| Reservation | A confirmed booking for a table at a specific date and time |
| Walk-in | Customer arriving without a prior reservation |
| No-show | Customer who does not arrive within the allowed grace period |
| Table Turnover | Time required to free and prepare a table for the next customer |
| Grace Period | Allowed waiting time before a reservation is marked as no-show |
| Capacity | Maximum number of guests that can be served at a time |
| Check-in | Confirmation that a reserved customer has arrived |
| Table Status | Current state of a table (Available / Reserved / Occupied) |

## Actors and Responsibilities
- Identify the different roles involved and what they do in practice.

| Actor / Role | Responsibilities |
|---|---|
| Customer (Diner) | Browse restaurants, check availability, make or modify reservations, check-in, place food orders |
| Restaurant Staff | Update table status, verify customer check-in, manage seating, handle walk-ins |
| Restaurant Manager | Configure restaurant profile, operating hours, seating capacity, and monitor reservations |
| System Admin | Maintain platform configuration, roles, and system-level settings |
| Payment Gateway | Handle reservation-related payment transactions |
| External Services | Provide GPS location data and customer reviews/ratings |

## Core workflows
Description of at least 2-3 real workflows as explained by the domain expert

- Workflow 1
  - Trigger/start condition: Customer wants to dine at a restaurant
  - Steps involved (in order):
    - Customer browses restaurants
    - Checks real-time table availability
    - Selects date, time, and party size
    - Confirms reservation
    - Receives reservation confirmation
  - Outcome / End condition:
    Reservation is created and table is marked as reserved

- Workflow 2
  - Trigger/start condition: Customer arrives at the restaurant
  - Steps involved (in order):
    - Staff verifies reservation
    - Customer checks in within grace period
    - Table status updated to occupied
  - Outcome / End condition:
    Customer is seated and reservation is marked as arrived

- Workflow 3
  - Trigger/start condition: Customer does not arrive within the grace period
  - Steps involved (in order):
    - System marks reservation as no-show
    - Table is released
    - Table becomes available for walk-ins or future reservations
  - Outcome / End condition:
    Seating capacity is restored and table is reused

## Rules, Constraints, and Exceptions
Document rules that govern how the domain operates.
  - Mandatory rules or policies:
    - Each reservation must support full CRUD operations
    - Reservation-related operations must follow ACID properties
  - Constraints or limitations:
    - Limited number of tables and seating capacity
    - Fixed restaurant operating hours
  - Common exceptions or edge cases:
    - Late arrivals within grace period
    - Partial party arrival
  - Situations where things usually go wrong:
    - Overlapping reservations
    - Incorrect table status updates
    - No-shows during peak hours

## Current challenges and pain points
- What parts of this process are most difficult or inefficient?
  Handling peak-hour reservations and walk-ins simultaneously.

- Where do delays, errors, or misunderstandings usually occur?
  During manual check-in and table reassignment after no-shows.

- What information is hardest to track or manage today?
  Real-time table status and accurate arrival tracking.

## Assumptions & Clarifications
- What assumptions made by the team that were confirmed
  - Reservation and table data require strong consistency
  - CRUD and ACID properties are mandatory for booking workflows

- What assumptions that were corrected
  - Staff interactions are critical and must be modeled explicitly, not treated as background operations

- Open questions that need follow-up
  - Handling reservation deposits or advance payments
  - Policy for repeated no-shows



