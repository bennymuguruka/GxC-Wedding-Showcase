import { Amplify } from "aws-amplify";
import { fetchAuthSession, getCurrentUser, signIn, signOut } from "aws-amplify/auth";
import outputs from "../amplify_outputs.json";
import { generateClient } from "aws-amplify/data";

Amplify.configure(outputs);
const client = generateClient({ authMode: "userPool" });

const authStatus = document.querySelector("#authStatus");
const signInSection = document.querySelector("#signInSection");
const accessDeniedSection = document.querySelector("#accessDeniedSection");
const dashboardSection = document.querySelector("#dashboardSection");

const signInForm = document.querySelector("#signInForm");
const signInError = document.querySelector("#signInError");
const emailInput = document.querySelector("#adminEmail");
const passwordInput = document.querySelector("#adminPassword");

const signOutButton = document.querySelector("#signOutButton");
const deniedSignOutButton = document.querySelector("#deniedSignOutButton");
const reportContent = document.querySelector("#reportContent");
const dashboardStatus = document.querySelector("#dashboardStatus");

const navigationButtons = document.querySelectorAll("#dashboardNav [data-view]");

const overviewContent = document.createElement("div");
const invitationContent = document.createElement("div");
const seatingContent = document.createElement("div");

const dashboardViews = {
    overview: overviewContent,
    invitations: invitationContent,
    seating: seatingContent
};

function showDashboardView(viewName) {
    if (!dashboardViews[viewName]) {
        return;
    }

    Object.entries(dashboardViews).forEach(([name, content]) => {
        content.hidden = name !== viewName;
    });

    navigationButtons.forEach((button) => {
        if (button.dataset.view === viewName) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

navigationButtons.forEach((button) => {
    button.addEventListener("click", () => {
        showDashboardView(button.dataset.view);
    });
});

const invitationCollator = new Intl.Collator("en-ZA", { sensitivity: "base", numeric: true });
const reportDateFormatter = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg"
});
let reportRequest = 0;

const sections = [
    signInSection,
    accessDeniedSection,
    dashboardSection
];

function showSection(section) {
    authStatus.hidden = true;

    sections.forEach((sectionElement) => {
        sectionElement.hidden = sectionElement !== section;
    });
}

function showSignIn() {
    signInError.textContent = "";
    showSection(signInSection);
    emailInput.focus();
}

async function hasAdminAccess() {
    const session = await fetchAuthSession({
        forceRefresh: true
    });

    const groups = session.tokens?.accessToken?.payload?.["cognito:groups"] ?? [];
    return Array.isArray(groups) && groups.includes("ADMINS");
}

async function openProtectedArea() {
    if (await hasAdminAccess()) {
        showSection(dashboardSection);
        await loadReport();
    }
    else {
        showSection(accessDeniedSection);
    }
}

async function handleSignInResult(result) {
    if (result.isSignedIn || result.nextStep?.signInStep === "DONE") {
        passwordInput.value = "";
        await openProtectedArea();
        return;
    }

    signInError.textContent = "Your account requires additional verification before signing in.";

    showSection(signInSection);
}

signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = signInForm.querySelector("button");

    if (button.disabled) {
        return;
    }

    signInError.textContent = "";
    button.disabled = true;
    button.textContent = "Signing in...";

    try {
        const result = await signIn({
            username: emailInput.value.trim(),
            password: passwordInput.value
        });

        await handleSignInResult(result);
    }
    catch (error) {
        if (error?.name === "NotAuthorizedException" || error?.name === "UserNotFoundException") {
            signInError.textContent = "The email address or password is incorrect.";
        }
        else if (error?.name === "LimitExceededException" || error?.name === "TooManyRequestsException") {
            signInError.textContent = "Too many attempts. Please wait and try again.";
        }
        else {
            signInError.textContent = "We could not complete sign-in. Please try again.";
        }
    }
    finally {
        button.disabled = false;
        button.textContent = "Sign in";
    }
});

async function handleSignOut() {
    reportRequest += 1;
    signOutButton.disabled = true;
    deniedSignOutButton.disabled = true;

    reportContent.replaceChildren();
    overviewContent.replaceChildren();
    invitationContent.replaceChildren();
    seatingContent.replaceChildren();
    seatingContent.replaceChildren();
    dashboardStatus.textContent = "";

    try {
        await signOut();
        signInForm.reset();
        showSignIn();
    } catch {
        authStatus.hidden = false;
        authStatus.textContent = "We could not sign you out. Please try again.";
    }
    finally {
        signOutButton.disabled = false;
        deniedSignOutButton.disabled = false;
    }
}

signOutButton.addEventListener("click", handleSignOut);
deniedSignOutButton.addEventListener("click", handleSignOut);

function renderTotals(invitations) {
    let attending = 0;
    let declined = 0;
    let allocatedSeats = 0;
    let confirmedAttendance = 0;
    for (const invitation of invitations) {
        allocatedSeats += Number(invitation.maximumPartySize) || 0;
        if (invitation.rsvpStatus === "ATTENDING") {
            attending += 1;
            confirmedAttendance += Number(invitation.confirmedPartySize) || 0;
        } else if (invitation.rsvpStatus === "DECLINED") {
            declined += 1;
        }
    }
    const responses = attending + declined;

    const responseRate = invitations.length ? Math.round((responses / invitations.length) * 1000) / 10 : 0;

    const totals = [
        ["Total invitations", invitations.length],
        ["Total allocated seats", allocatedSeats],
        ["Confirmed attendance", confirmedAttendance],
        ["Declined invitations", declined],
        ["Outstanding responses", invitations.length - responses],
        ["RSVP response rate", `${responseRate}%`]
    ];

    const summary = document.createElement("dl");
    summary.className = "report-totals";

    totals.forEach(([label, value]) => {
        const item = document.createElement("div");
        const title = document.createElement("dt");
        title.textContent = label;

        const amount = document.createElement("dd");
        amount.textContent = String(value);

        item.append(title, amount);
        summary.append(item);
    });

    overviewContent.append(summary);
}

function formatReportDate(value) {
    if (!value) {
        return "Not recorded";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return reportDateFormatter.format(date);
}

function confirmInvitationSend(recipients) {
    const dialog = document.createElement("dialog");
    dialog.className = "send-confirmation";
    dialog.setAttribute("aria-labelledby", "sendConfirmationTitle");
    dialog.setAttribute("aria-describedby", "sendConfirmationDescription");
    dialog.innerHTML = `
        <form method="dialog">
            <h2 id="sendConfirmationTitle">Send invitations?</h2>
            <p id="sendConfirmationDescription"></p>
            <ul class="confirmation-recipients"></ul>
            <div class="confirmation-actions">
                <button type="submit" value="cancel" class="secondary-button" autofocus>Cancel</button>
                <button type="submit" value="send">Send invitations</button>
            </div>
        </form>
    `;
    dialog.querySelector("p").textContent =
        `You’re about to send ${recipients.length} WhatsApp invitation${recipients.length === 1 ? "" : "s"}. ` +
        "Review every recipient below, including guests hidden by your search or filters.";
    const list = dialog.querySelector("ul");
    for (const { invitation } of recipients) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = invitation.primaryGuestName ?? "Unnamed invitation";
        const phone = document.createElement("span");
        phone.textContent = invitation.phoneNumber;
        item.append(name, phone);
        list.append(item);
    }
    return new Promise((resolve) => {
        dialog.addEventListener("close", () => {
            const confirmed = dialog.returnValue === "send";
            dialog.remove();
            resolve(confirmed);
        }, { once: true });
        document.body.append(dialog);
        dialog.showModal();
    });
}

function renderInvitationTable(invitations) {
    const toolbar = document.createElement("div");
    toolbar.className = "invitation-toolbar";
    toolbar.innerHTML = `
        <label>Search invitations
            <input type="search" placeholder="Name, phone number or invitation code" autocomplete="off">
        </label>
        <label>Sort by
            <select data-control="sort">
                <option value="name-asc">Name: A–Z</option>
                <option value="name-desc">Name: Z–A</option>
                <option value="seats-desc">Allocated seats: most first</option>
                <option value="seats-asc">Allocated seats: fewest first</option>
                <option value="status">RSVP status</option>
            </select>
        </label>
        <div class="invitation-actions">
            <button type="button" data-control="send" disabled>Send selected invitations</button>
        </div>
        <p class="invitation-count" role="status"></p>
        <p class="batch-status" role="status"></p>
    `;
    const search = toolbar.querySelector("input");
    const sort = toolbar.querySelector('[data-control="sort"]');
    const sendButton = toolbar.querySelector('[data-control="send"]');
    const count = toolbar.querySelector(".invitation-count");
    const batchStatus = toolbar.querySelector(".batch-status");
    const selected = new Set();
    let sending = false;
    let confirming = false;
    let visible = [];

    const wrapper = document.createElement("div");
    wrapper.className = "report-table-wrapper";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", "Invitation list");
    const table = document.createElement("table");
    table.className = "report-table";
    const caption = document.createElement("caption");
    caption.textContent = "Invitations";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const selectionHeading = document.createElement("th");
    selectionHeading.scope = "col";
    const selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.setAttribute("aria-label", "Select all visible invitations eligible for sending");
    selectionHeading.append(selectAll);
    headerRow.append(selectionHeading);
    ["Main invitee", "Phone number", "Allocated seats", "RSVP status",
        "WhatsApp status"].forEach((heading) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = heading;
        headerRow.append(cell);
    });
    head.append(headerRow);
    const body = document.createElement("tbody");
    const statusLabels = { PENDING: "Outstanding", ATTENDING: "Attending", DECLINED: "Declined" };
    const entries = invitations.map((invitation) => {
        const status = invitation.rsvpStatus ?? "PENDING";
        const names = (invitation.guestNames ?? []).filter((name) => typeof name === "string" && name.trim());
        const row = document.createElement("tr");
        const selectionCell = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", `Select ${invitation.primaryGuestName ?? "unnamed invitation"}`);
        selectionCell.append(checkbox);
        row.append(selectionCell);
        const values = [
            invitation.primaryGuestName ?? "Unnamed invitation", invitation.phoneNumber ?? "-",
            invitation.maximumPartySize ?? "-", statusLabels[status] ?? "Unknown",
            invitation.whatsappDeliveryStatus?.toLowerCase().replaceAll("_", " ") || "Not recorded"
        ];
        values.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.append(cell);
        });
        const entry = {
            invitation, status, row, checkbox, accepted: false,
            searchable: [invitation.primaryGuestName, invitation.phoneNumber, invitation.id, ...names].join(" ").toLowerCase()
        };
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) selected.add(entry);
            else selected.delete(entry);
            updateSelection();
        });
        return entry;
    });
    const eligible = (entry) => Boolean(entry.invitation.id && entry.invitation.phoneNumber && !entry.accepted);

    function updateSelection() {
        const available = visible.filter(eligible);
        const checked = available.filter((entry) => selected.has(entry)).length;
        selectAll.checked = available.length > 0 && checked === available.length;
        selectAll.indeterminate = checked > 0 && checked < available.length;
        selectAll.disabled = sending || available.length === 0;
        sendButton.disabled = sending || selected.size === 0;
        const visibleEntries = new Set(visible);
        const hiddenSelected = [...selected].filter((entry) => !visibleEntries.has(entry)).length;
        count.textContent = `${visible.length} of ${entries.length} invitations shown · ${selected.size} selected` +
            (hiddenSelected ? ` (${hiddenSelected} hidden by filters)` : "");
        entries.forEach((entry) => {
            entry.checkbox.checked = selected.has(entry);
            entry.checkbox.disabled = sending || !eligible(entry);
            entry.row.classList.toggle("is-selected", selected.has(entry));
        });
    }

    function updateTable() {
        const query = search.value.trim().toLowerCase();
        visible = entries.filter((entry) => !query || entry.searchable.includes(query));
        const byName = (a, b) => invitationCollator.compare(a.invitation.primaryGuestName ?? "", b.invitation.primaryGuestName ?? "") ||
            invitationCollator.compare(a.invitation.id ?? "", b.invitation.id ?? "");
        visible.sort((a, b) => {
            switch (sort.value) {
                case "name-desc": return -byName(a, b);
                case "seats-desc": return (Number(b.invitation.maximumPartySize) || 0) - (Number(a.invitation.maximumPartySize) || 0) || byName(a, b);
                case "seats-asc": return (Number(a.invitation.maximumPartySize) || 0) - (Number(b.invitation.maximumPartySize) || 0) || byName(a, b);
                case "status": return invitationCollator.compare(statusLabels[a.status] ?? a.status, statusLabels[b.status] ?? b.status) || byName(a, b);
                default: return byName(a, b);
            }
        });
        const fragment = document.createDocumentFragment();
        visible.forEach((entry) => fragment.append(entry.row));
        if (!visible.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 6;
            cell.textContent = "No invitations match your search.";
            row.append(cell);
            fragment.append(row);
        }
        body.replaceChildren(fragment);
        updateSelection();
    }

    search.addEventListener("input", updateTable);
    sort.addEventListener("change", updateTable);
    selectAll.addEventListener("change", () => {
        visible.filter(eligible).forEach((entry) => {
            if (selectAll.checked) selected.add(entry);
            else selected.delete(entry);
        });
        updateSelection();
    });
    sendButton.addEventListener("click", async () => {
        if (sending || confirming || !selected.size) return;
        const recipients = [...selected].filter(eligible);
        if (!recipients.length) return;
        confirming = true;
        let confirmed;
        try {
            confirmed = await confirmInvitationSend(recipients);
        } finally {
            confirming = false;
            sendButton.focus();
        }
        if (!confirmed) return;
        sending = true;
        signOutButton.disabled = true;
        search.disabled = sort.disabled = true;
        let accepted = 0;
        let failed = 0;
        updateSelection();
        try {
            for (const entry of recipients) {
                batchStatus.textContent = `Sending ${accepted + failed + 1} of ${recipients.length}… Keep this page open.`;
                try {
                    const { data, errors } = await client.mutations.sendInvitation(
                        { code: entry.invitation.id }, { authMode: "userPool" }
                    );
                    if (errors?.length || !data) throw new Error(errors?.[0]?.message || "No message ID was returned");
                    entry.accepted = true;
                    selected.delete(entry);
                    accepted += 1;
                } catch (error) {
                    failed += 1;
                }
                updateSelection();
            }
            batchStatus.textContent = `${accepted} accepted by WhatsApp` +
                (failed ? ` · ${failed} not confirmed` : ".");
        } finally {
            sending = false;
            signOutButton.disabled = false;
            search.disabled = sort.disabled = false;
            updateSelection();
        }
    });
    table.append(caption, head, body);
    wrapper.append(table);
    invitationContent.append(toolbar, wrapper);
    updateTable();
}

function renderSeating(invitations, tables) {
    seatingContent.replaceChildren();

    const title = document.createElement("h3");
    title.textContent = "Seating plan";
    const note = document.createElement("p");
    note.className = "seating-note";
    note.textContent = "Only confirmed RSVP parties appear here. Table capacity is measured against confirmed guests.";
    const status = document.createElement("p");
    status.className = "seating-status";
    status.setAttribute("role", "status");

    const form = document.createElement("form");
    form.className = "table-form";
    form.innerHTML = `
        <label>Table name
            <input name="name" maxlength="80" required placeholder="For example, Table 1">
        </label>
        <label>Seats available
            <input name="capacity" type="number" min="1" max="100" step="1" required>
        </label>
        <button type="submit">Add table</button>
    `;

    const confirmedParties = invitations.filter((invitation) =>
        invitation.rsvpStatus === "ATTENDING" && Number(invitation.confirmedPartySize) > 0
    );
    const sortedTables = [...tables].sort((a, b) =>
        invitationCollator.compare(a.name ?? "", b.name ?? "")
    );
    const tableById = new Map(sortedTables.map((table) => [table.id, table]));
    const seatsFor = (tableId, exceptInvitationId) => confirmedParties
        .filter((invitation) => invitation.seatingTableId === tableId && invitation.id !== exceptInvitationId)
        .reduce((total, invitation) => total + Number(invitation.confirmedPartySize), 0);

    const assignParty = async (invitation, seatingTableId, select) => {
        const previousTableId = invitation.seatingTableId ?? "";
        if (seatingTableId === previousTableId) return;
        const table = seatingTableId ? tableById.get(seatingTableId) : undefined;
        const partySize = Number(invitation.confirmedPartySize);
        if (table && seatsFor(table.id, invitation.id) + partySize > Number(table.capacity)) {
            status.textContent = `${table.name} does not have enough remaining seats for this party.`;
            select.value = previousTableId;
            return;
        }

        select.disabled = true;
        status.textContent = "Saving table assignment…";
        try {
            const result = await client.models.Invitation.update(
                { id: invitation.id, seatingTableId: seatingTableId || null },
                { authMode: "userPool" }
            );
            if (result.errors?.length || !result.data) {
                throw new Error(result.errors?.[0]?.message || "The assignment could not be saved.");
            }
            invitation.seatingTableId = seatingTableId || null;
            renderSeating(invitations, tables);
        } catch (error) {
            select.disabled = false;
            select.value = previousTableId;
            status.textContent = error?.message || "The assignment could not be saved.";
        }
    };

    const partyRow = (invitation) => {
        const row = document.createElement("li");
        row.className = "seating-party";
        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = invitation.primaryGuestName ?? "Unnamed invitation";
        const size = document.createElement("span");
        const guests = Number(invitation.confirmedPartySize);
        size.textContent = `${guests} confirmed ${guests === 1 ? "guest" : "guests"}`;
        details.append(name, size);

        const select = document.createElement("select");
        select.setAttribute("aria-label", `Assign ${invitation.primaryGuestName ?? "party"} to a table`);
        const unassigned = document.createElement("option");
        unassigned.value = "";
        unassigned.textContent = "Unassigned";
        select.append(unassigned);
        sortedTables.forEach((table) => {
            const option = document.createElement("option");
            option.value = table.id;
            option.textContent = table.name;
            select.append(option);
        });
        select.value = invitation.seatingTableId ?? "";
        select.addEventListener("change", () => assignParty(invitation, select.value, select));
        row.append(details, select);
        return row;
    };

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nameInput = form.elements.namedItem("name");
        const capacityInput = form.elements.namedItem("capacity");
        const name = nameInput.value.trim();
        const capacity = Number(capacityInput.value);
        if (!name || !Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
            status.textContent = "Enter a table name and a whole number of seats between 1 and 100.";
            return;
        }
        const button = form.querySelector("button");
        button.disabled = true;
        status.textContent = "Adding table…";
        try {
            const result = await client.models.SeatingTable.create(
                { name, capacity }, { authMode: "userPool" }
            );
            if (result.errors?.length || !result.data) {
                throw new Error(result.errors?.[0]?.message || "The table could not be created.");
            }
            tables.push(result.data);
            renderSeating(invitations, tables);
        } catch (error) {
            button.disabled = false;
            status.textContent = error?.message || "The table could not be created.";
        }
    });

    const summary = document.createElement("p");
    summary.className = "seating-summary";
    const assignedSeats = confirmedParties
        .filter((invitation) => invitation.seatingTableId && tableById.has(invitation.seatingTableId))
        .reduce((total, invitation) => total + Number(invitation.confirmedPartySize), 0);
    summary.textContent = `${assignedSeats} of ${confirmedParties.reduce((total, invitation) => total + Number(invitation.confirmedPartySize), 0)} confirmed guests assigned.`;

    const tablesList = document.createElement("div");
    tablesList.className = "seating-tables";
    sortedTables.forEach((table) => {
        const assignedParties = confirmedParties.filter((invitation) => invitation.seatingTableId === table.id);
        const assignedSeats = seatsFor(table.id);
        const card = document.createElement("section");
        card.className = "seating-table";
        const heading = document.createElement("h4");
        heading.textContent = table.name;
        const capacity = document.createElement("p");
        capacity.textContent = `${assignedSeats} of ${table.capacity} seats assigned · ${Math.max(0, Number(table.capacity) - assignedSeats)} remaining`;
        const parties = document.createElement("ul");
        parties.className = "seating-parties";
        assignedParties.forEach((invitation) => parties.append(partyRow(invitation)));
        if (!assignedParties.length) {
            const empty = document.createElement("p");
            empty.className = "seating-empty";
            empty.textContent = "No confirmed parties assigned.";
            card.append(heading, capacity, empty);
        } else {
            card.append(heading, capacity, parties);
        }
        tablesList.append(card);
    });

    const unassigned = confirmedParties.filter((invitation) => !invitation.seatingTableId || !tableById.has(invitation.seatingTableId));
    const unassignedSection = document.createElement("section");
    unassignedSection.className = "unassigned-parties";
    const unassignedTitle = document.createElement("h4");
    unassignedTitle.textContent = "Unassigned confirmed parties";
    const unassignedList = document.createElement("ul");
    unassignedList.className = "seating-parties";
    unassigned.forEach((invitation) => unassignedList.append(partyRow(invitation)));
    if (unassigned.length) {
        unassignedSection.append(unassignedTitle, unassignedList);
    } else if (confirmedParties.length) {
        const complete = document.createElement("p");
        complete.textContent = "Every confirmed party has a table assignment.";
        unassignedSection.append(unassignedTitle, complete);
    }

    seatingContent.append(title, note, form, status, summary);
    if (sortedTables.length) seatingContent.append(tablesList);
    if (confirmedParties.length) seatingContent.append(unassignedSection);
}

async function loadReport() {
    const request = ++reportRequest;

    overviewContent.replaceChildren();
    invitationContent.replaceChildren();

    reportContent.replaceChildren(
        overviewContent,
        invitationContent,
        seatingContent
    );

    showDashboardView("overview");
    dashboardStatus.textContent = "Loading dashboard...";

    try {
        const invitations = [];
        let nextToken;

        do {
            const result = await client.models.Invitation.list({
                authMode: "userPool",
                limit: 100,
                nextToken
            });

            if (request !== reportRequest) {
                return;
            }

            if (result.errors?.length) {
                throw new Error("Invitation report could not be loaded");
            }

            invitations.push(...(result.data ?? []));
            nextToken = result.nextToken ?? undefined;
        }
        while (nextToken);

        const tables = [];
        nextToken = undefined;
        do {
            const result = await client.models.SeatingTable.list({
                authMode: "userPool",
                limit: 100,
                nextToken
            });

            if (request !== reportRequest) {
                return;
            }

            if (result.errors?.length) {
                throw new Error("Seating tables could not be loaded");
            }

            tables.push(...(result.data ?? []));
            nextToken = result.nextToken ?? undefined;
        }
        while (nextToken);

        renderTotals(invitations);
        renderInvitationTable(invitations);
        renderSeating(invitations, tables);

        dashboardStatus.textContent = invitations.length ? "" : "No invitations have been added yet.";
    }
    catch {
        if (request !== reportRequest) {
            return;
        }

        reportContent.replaceChildren();
        dashboardStatus.textContent = "We could not load the report. Please refresh and try again.";
    }
}


async function initializeAdmin() {
    try {
        await getCurrentUser();
        await openProtectedArea();
    }
    catch {
        showSignIn();
    }
}

initializeAdmin();
