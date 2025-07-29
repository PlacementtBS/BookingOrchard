export function bookingWorflowHTML(){
    return(`
        <section class="fullHeight">
        <div>
            <div>
                <h2>Booking Start</h2>
            </div>
            <div>
                <h3>Enquiry</h3>
                <div>
                    <div style="border: black solid 1px;">
                        <h4>Booking Requirements</h4>
                        <p>We will automatically ask you to provide the rooms being booked and [dependant on option {provide the equipment being hired}, <br>{email the client a form to set the equipment required)</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Custom Form</h4>
                        <p>Form Name {set in options}</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Schedule Staff</h4>
                        <p>We will prompt you to schedule staff onto the event</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Quote</h4>
                        <p>We will generate a quote for the event using the information provided and prompt you to review and confirm the quote and then send it to the <br>client for agreement</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Booking Agreement</h4>
                        <p>We will ssend the client {selected in options} booking agreement</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Email Client</h4>
                        <p>We will email the client {set body and subject in option}</p>
                    </div>
                    <h1>+</h1>
                </div>
            </div>
            <div>
                <h3>Event Confirmed</h3>
                <div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Event Confirmation</h4>
                        <p>We will notify {you, scheduled staff, the client} that the event has been confirmed</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Email Client</h4>
                        <p>We will email the client {set body and subject in option}</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Custom Document</h4>
                        <p>We will create a document using the {template} template</p>
                    </div>
                    <h1>+</h1>
                </div>
            </div>
            <div>
                <h3>During Event</h3>
                <div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Custom Form</h4>
                        <p>We will request {person} completes {form} form</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Email Client</h4>
                        <p>We will email the client {set body and subject in option}</p>
                    </div>
                    <h1>+</h1>
                </div>
            </div>
            <div>
                <h3>After Event</h3>
                <div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Email Client</h4>
                        <p>We will email the client {set body and subject in option}</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Custom Form</h4>
                        <p>We will request {person} completes {form} form</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Custom Document</h4>
                        <p>We will create a document using the {template} template</p>
                    </div>
                    <h1>+</h1>
                    <div style="border: black solid 1px;">
                        <h4>Invoice</h4>
                        <p>We will generate a invoice for the event using the information provided and prompt you to review and confirm the invoice and then send it to the <br>client for payment</p>
                    </div>
                    <h1>+</h1>
                </div>
            </div>
            <div>
                <h2>Booking End</h2>
            </div>
        </div>
        <div class="third">
            <h2>Options</h2>
        </div>
        </section>
        `)
}
export async function loadBookingWorkflow(currentUser){
    return;
}
