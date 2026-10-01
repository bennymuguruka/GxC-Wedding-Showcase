import { client } from "./demo-client.js";

//==========Header==========//
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
    if (window.scrollY > 0.55) {
        header.classList.add('scrolled');

    }
    else { header.classList.remove('scrolled') };
})

//=============Countdown==============//
const weddingDate = new Date("2027-12-12T14:00:00+02:00");

const Countdown = document.querySelector("#counter");
const daysElement = document.querySelector("#days");
const hoursElement = document.querySelector("#hours");
const minutesElement = document.querySelector("#minutes");
const secondsElement = document.querySelector("#seconds");

function updateCountdown() {
    const timeRemaining = weddingDate.getTime() - Date.now();

    if (timeRemaining <= 0) {
        Countdown.innerHTML = "<h2>Today is the Day!</h2>";
        clearInterval(CountdownInterval);
        return
    }

    const days = Math.floor(timeRemaining / (1000 * 60 * 60* 24));
    const hours = Math.floor((timeRemaining / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
    const seconds = Math.floor((timeRemaining / 1000) % 60);

    daysElement.textContent = days;
    hoursElement.textContent = String(hours).padStart(2, "0");
    minutesElement.textContent = String(minutes).padStart(2, "0");
    secondsElement.textContent = String(seconds).padStart(2, "0");
}

const CountdownInterval = setInterval(updateCountdown, 1000);

updateCountdown();

//=============RSVP steps==============//
const rsvpButton = document.querySelector("#rsvpButton");
const rsvpSection = document.querySelector("#RSVP");
const rsvpModal = document.querySelector("#rsvpModal");
const rsvpCloseButton = document.querySelector("#rsvpClose");
const attendanceStep = document.querySelector("#rsvp-attendance");
const partySizeStep = document.querySelector("#rsvp-party-size");
const attendanceNextButton = attendanceStep.querySelector(".next");
const confirmRsvpButton = document.querySelector("#Confirm");

const invitationStatus = document.querySelector("#invitationStatus");
const quantitySelect = document.querySelector("#quantity");
const additionalGuests = document.querySelector("#additionalGuests");

const rsvpForm = document.querySelector("#rsvpForm");
const rsvpError = document.querySelector("#rsvpError");
const partyControls = document.querySelector("#partyControls");
const declineMessage = document.querySelector("#declineMessage");
const primaryGuestSummary = document.querySelector("#primaryGuestSummary");
const rsvpBackButton = document.querySelector("#rsvpBack");

let currentInvitation = null;

let isSaving = false;
rsvpForm.noValidate = true;

function renderAdditionalGuests(savedNames) {
    const names = savedNames?? Array.from(
        additionalGuests.querySelectorAll("input"),
        (input) => input.value,
    );

    additionalGuests.replaceChildren();

    const partySize = Number(quantitySelect.value);

    for (let index = 0; index < partySize -1; index++) {
        const field = document.createElement("div");
        field.className = "additional-guest-field";

        const label = document.createElement("label");
        label.htmlFor = `additionalGuest${index}`;
        label.textContent = `Additional guest ${index + 1}`;

        const input = document.createElement("input");
        input.id = label.htmlFor;
        input.name = `additionalGuest${index}`;
        input.type = "text";
        input.placeholder = "First and last name";
        input.autocomplete = `section-rsvp-guest-${index} name`;
        input.enterKeyHint = "next";
        input.required = true;
        input.value = names[index] ?? "";

        field.append(label, input);
        additionalGuests.append(field);
        
    }
}

quantitySelect.addEventListener("change", ()=>{
    renderAdditionalGuests();
});

function updateAttendanceControls() {
    const selected = rsvpForm.querySelector(
        'input[name="attendance"]:checked',
    );

    const attending = selected?.value === "ATTENDING";

    partyControls.classList.toggle("hidden", !attending);
    declineMessage.classList.toggle(
        "hidden",
        selected?.value !== "DECLINED",
    );

    quantitySelect.disabled = isSaving || !attending;

    additionalGuests.querySelectorAll("input").forEach((input) => {
        input.disabled = isSaving || !attending;
    });
}

function setSaving(saving) {
    isSaving = saving;

    rsvpForm.setAttribute("aria-busy", String(saving));

    rsvpForm.querySelectorAll("input, select, button").forEach(
        (element) => {
            element.disabled = saving;
        },
    );

    rsvpCloseButton.disabled = saving;
    rsvpButton.disabled = saving || !currentInvitation;
    confirmRsvpButton.disabled = saving || !currentInvitation;

    confirmRsvpButton.textContent = saving
        ? "Saving..."
        : "Confirm RSVP";

    updateAttendanceControls();
}



const landingStatus = document.querySelector("#landingStatus");
const retryInvitation = document.querySelector("#retryInvitation");
retryInvitation.addEventListener("click", loadInvitation);

async function loadInvitation() {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code){
        invitationStatus.textContent = "Please use the personal invitation link sent to you.";
        return;
    }

    landingStatus.textContent = "Opening your invitation…";
    retryInvitation.hidden = true;

    try{
        const {data, errors } = await client.queries.lookupInvitation(
            {code},
            {authMode: "identityPool"}
        );

        if(errors?.length){
            throw new Error("Invitation lookup falied");
            
        }

        if (!data) {
            invitationStatus.textContent = "We could not find this invitation. Please check your link.";
            landingStatus.textContent = invitationStatus.textContent;
            return;
        }

        const maximumPartySize = Number(data.maximumPartySize);

        if (!Number.isInteger(maximumPartySize) || maximumPartySize < 1 || maximumPartySize > 20)
        {
            throw new Error("Invalid invitation allocation");
        }

        currentInvitation = data;

        invitationStatus.textContent = 
        `Welcome, ${data.primaryGuestName}.
        We have reserved up to ${maximumPartySize}
        ${maximumPartySize === 1? "seat" : "seats"} for you.`

        quantitySelect.replaceChildren();

        for (let size = 1; size <= maximumPartySize; size += 1 ){
            const option = document.createElement("option");
            option.value = String(size);
            option.textContent = String(size);
            quantitySelect.append(option);
        }

        quantitySelect.disabled = false;
        rsvpButton.disabled = false;
        document.body.classList.remove("invitation-locked");
    }
    catch (error)
    {
        console.error("Could not load invitation", error);
        invitationStatus.textContent = "We could not check your invitation right now. Please try again later";
        landingStatus.textContent = invitationStatus.textContent;
        retryInvitation.hidden = false;
    }
}

loadInvitation();

function openRsvpModal() {
    if (!currentInvitation || isSaving) return;

    rsvpForm.reset();
    rsvpError.textContent = "";

    rsvpForm.querySelectorAll('input[name="attendance"]').forEach(
        (radio) => {
            radio.checked = radio.value === currentInvitation.rsvpStatus;
        },
    );

    const previousSize = Number(currentInvitation.confirmedPartySize);

    quantitySelect.value = String(
        Number.isInteger(previousSize) && previousSize >= 1
            ? Math.min(previousSize, currentInvitation.maximumPartySize)
            : 1,
    );

    primaryGuestSummary.textContent =
        `Main invitee: ${currentInvitation.primaryGuestName}`;

    renderAdditionalGuests(currentInvitation.guestNames ?? []);
    updateAttendanceControls();

    attendanceStep.classList.remove("hidden");
    partySizeStep.classList.add("hidden");
    rsvpModal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    setSaving(false);
    rsvpCloseButton.focus();
}

function closeRsvpModal() {
    if (isSaving) return;
    rsvpModal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    rsvpButton.focus();
}

rsvpButton.addEventListener("click", openRsvpModal);
rsvpCloseButton.addEventListener("click", closeRsvpModal);

rsvpModal.addEventListener("click", (event) => {
    if (event.target === rsvpModal) {
        closeRsvpModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !rsvpModal.classList.contains("hidden")) {
        closeRsvpModal();
    }
});

attendanceNextButton.addEventListener("click", (event) => {
    event.preventDefault();

    const selected = rsvpForm.querySelector(
        'input[name="attendance"]:checked',
    );

    if (!selected) {
        rsvpError.textContent = "Please choose Yes or No.";
        rsvpError.focus();
        return;
    }

    rsvpError.textContent = "";
    updateAttendanceControls();

    attendanceStep.classList.add("hidden");
    partySizeStep.classList.remove("hidden");

    if (selected.value === "ATTENDING") {
        quantitySelect.focus();
    } else {
        rsvpBackButton.focus();
    }
});

rsvpBackButton.addEventListener("click", () => {
    rsvpError.textContent = "";
    partySizeStep.classList.add("hidden");
    attendanceStep.classList.remove("hidden");

    rsvpForm.querySelector(
        'input[name="attendance"]:checked',
    )?.focus();
});

rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (
        isSaving ||
        !currentInvitation ||
        rsvpModal.classList.contains("hidden")
    ) {
        return;
    }

    if (!attendanceStep.classList.contains("hidden")) {
        attendanceNextButton.click();
        return;
    }

    rsvpError.textContent = "";

    const selected = rsvpForm.querySelector(
        'input[name="attendance"]:checked',
    );

    if (!selected) {
        rsvpError.textContent = "Please choose Yes or No.";
        rsvpError.focus();
        return;
    }

    const attending = selected.value === "ATTENDING";
    const partySize = attending ? Number(quantitySelect.value) : 0;

    const guestNames = attending
        ? Array.from(
            additionalGuests.querySelectorAll("input"),
            (input) => input.value.trim(),
        )
        : [];

    if (
        attending &&
        (
            !Number.isInteger(partySize) ||
            partySize < 1 ||
            partySize > currentInvitation.maximumPartySize
        )
    ) {
        rsvpError.textContent = "Please choose a valid number attending.";
        rsvpError.focus();
        return;
    }

    if (!rsvpForm.reportValidity()) return;

    if (
        attending &&
        (
            guestNames.length !== partySize - 1 ||
            guestNames.some((name) => !name)
        )
    ) {
        rsvpError.textContent =
            "Please enter a name for each additional guest.";
        rsvpError.focus();
        return;
    }

    let saved = false;
    setSaving(true);

    try {
        const code = new URLSearchParams(window.location.search).get("code");

        const { data, errors } = await client.mutations.submitRsvp(
            {
                code,
                status: selected.value,
                partySize,
                guestNames,
            },
            { authMode: "identityPool" },
        );

        if (errors?.length) {
            throw new Error(
                errors.map((error) => error.message).join(" "),
            );
        }

        if (!data?.success) {
            throw new Error(
                "We could not confirm your RSVP was saved. Please try again.",
            );
        }

        currentInvitation = {
            ...currentInvitation,
            rsvpStatus: data.rsvpStatus,
            confirmedPartySize: data.confirmedPartySize,
            guestNames: data.guestNames,
        };

        invitationStatus.textContent =
            data.rsvpStatus === "ATTENDING"
                ? `Thank you, ${currentInvitation.primaryGuestName}! Your RSVP is saved for ${data.confirmedPartySize} attending.`
                : `Thank you for letting us know, ${currentInvitation.primaryGuestName}. Your decline is saved.`;

        rsvpButton.textContent = "Update RSVP";
        saved = true;
    } catch (error) {
        rsvpError.textContent =
            error instanceof Error
                ? error.message
                : "We could not save your RSVP. Please try again.";

        rsvpError.focus();
    } finally {
        setSaving(false);
    }

    if (saved) {
        closeRsvpModal();
    }
});
