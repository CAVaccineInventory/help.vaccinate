# Scooby script answers to VIAL output

This document maps answers in Scooby to (expected) outcomes in VIAL for Reports. This document is up to date as of April 26th.

## Are you currently offering the COVID-19 vaccine?

- Yes - Does nothing
- Sort of
  - Expect to offer within 2 weeks - Adds availability tag`Yes: coming soon`
  - Want to, don't know when - Adds availability tag `No: may be a vaccination site in the future`
  - Private site - Adds availability  tag `No: not open to the public`
  - Only staff - Adds availability tag `No: only vaccinating staff`
- No - Adds availability tag `No: may be a vaccination site in the future`
- No, Never - Adds availability tag `No: will never be a vaccination site`

## Which types of COVID vaccine do you offer?

Sets `Vaccines offered` as an array of values: `["Moderna", "Pfizer", "Johnson & Johnson", "Other"]`

## Do you require appointments, or are walk-ins accepted?

- Appointment Required - Adds availability tag `Yes: appointment required`
- Accept appointments and walk-ins - Adds availability tag `Yes: appointments or walk-ins accepted`
- Walk-ins only - Adds availability tag `Walk-ins only`

***If nothing is selected, defaults to `Yes: appointment required`***

## How do you make an appointment?

Sets `Appointment details` to the value of the input. VIAL determines the `Appointment tag` based on the value of `Appointment details`.

## Do you know if you have any open appointments that someone could book right now?

- Yes - Adds availability tag `Yes: appointments available`
- No - Adds avaialbility tag `Yes: appointment calendar currently full`
- Not sure - Does nothing

## Can anyone sign up to be vaccinated, or are there any restrictions or limits?

- Veterans Only - Adds availability tag `Yes: must be a veteran`
- Current patients only - Adds availability tag `Yes: must be a current patient`
- County residents/workers only - Adds availability tag `Yes: restricted to county residents`
- Other - Does nothing


## When will the the pharmacy stop offering COVID-19 vaccines?

Sets the `Planned closure` date

## Public Notes

Sets the `Public notes` text

## Private Notes

Sets the `Internal notes` text
