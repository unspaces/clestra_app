frappe.pages['email_signature'].on_page_load = function(wrapper) {
    // Use const for page object
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Email Signature Generator'), // Set title here
        single_column: true
    });

    page.wrapper = $(wrapper);

    // Store fetched data globally within this page's scope
    page.signature_data = {
        divisions: {},
        footers: {}
    };

    // --- HTML Structure with Updated Styles ---
    const page_html = `
        <div class="email-signature-page-container layout-main-section">
            <div class="email-signature-form-container">
                <style>
                    .email-signature-page-container {
                        padding-top: 15px; /* Add some top padding */
                    }
                    .email-signature-form-container {
                        max-width: 800px; /* Slightly wider */
                        margin: 0 auto; /* Center the container */
                        padding: var(--padding-xl); /* Use Frappe padding */
                        background-color: var(--card-bg);
                        border-radius: var(--border-radius-lg);
                        border: 1px solid var(--border-color);
                        /* box-shadow: var(--shadow-sm); */ /* Optional: subtle shadow */
                    }
                    .email-signature-form-container h2 {
                        text-align: center;
                        margin-bottom: var(--margin-xl);
                        color: var(--heading-color);
                        font-weight: 600; /* Slightly bolder */
                    }
                    .email-signature-form-container .form-section {
                        margin-bottom: var(--margin-lg);
                    }
                    .email-signature-form-container .form-row {
                        display: flex;
                        flex-wrap: wrap;
                        gap: var(--margin-lg); /* Consistent gap */
                        margin-bottom: var(--margin-lg);
                    }
                    .email-signature-form-container .form-column {
                        flex: 1;
                        min-width: 200px; /* Prevent columns getting too small */
                        display: flex;
                        flex-direction: column;
                    }
                    .email-signature-form-container label {
                        font-size: var(--text-sm); /* Use Frappe text size */
                        font-weight: 600; /* Standard label weight */
                        color: var(--text-color);
                        margin-bottom: var(--margin-xs); /* Smaller margin */
                        display: block; /* Ensure it takes block space */
                    }
                    .email-signature-form-container .form-control {
                        /* Inherit Frappe's .form-control styles where possible */
                        /* Or define explicitly if needed */
                        width: 100%;
                        padding: var(--padding-md);
                        font-size: var(--text-base);
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        background-color: var(--control-bg);
                        color: var(--text-color);
                        box-sizing: border-box;
                    }
                    .email-signature-form-container select.form-control {
                       /* Ensure select looks consistent */
                       appearance: none; /* Remove default arrow */
                       background-image: var(--select-arrow-img); /* Use Frappe's arrow */
                       background-repeat: no-repeat;
                       background-position: right var(--padding-md) center;
                       background-size: 12px; /* Adjust size if needed */
                    }
                    .email-signature-form-container input.form-control:focus,
                    .email-signature-form-container select.form-control:focus {
                        border-color: var(--primary);
                        box-shadow: 0 0 0 1px var(--primary-light); /* Frappe focus style */
                        outline: none;
                    }
                    .email-signature-form-container .btn-primary {
                        /* Use Frappe's button variables */
                        padding: var(--padding-md) var(--padding-lg);
                        font-size: var(--text-base);
                        font-weight: 600;
                        border-radius: var(--border-radius);
                        cursor: pointer;
                        transition: background-color 0.2s ease;
                        width: 100%; /* Make button full width in its column */
                        max-width: 300px; /* Optional: Max width for buttons */
                        margin: 0 auto; /* Center buttons if max-width is set */
                        display: block; /* Ensure block display */

						background-color: #0078d4; /* Your desired background color */
                        color: #ffffff; /* Set text color to white for contrast */
                    }
                     .email-signature-form-container .btn-secondary { /* Style for copy button */
                        background-color: var(--btn-secondary-bg);
                        color: var(--btn-secondary-color);
                        border: 1px solid var(--border-color);
                     }
                      .email-signature-form-container .btn-secondary:hover {
						background-color: #005a9e; /* Your desired hover background color */
                        color: #ffffff; /* Keep text color white on hover */
                      }
                    .email-signature-form-container .button-group {
                        display: flex;
                        flex-direction: column;
                        align-items: center; /* Center buttons */
                        gap: var(--margin-md);
                        margin-top: var(--margin-xl);
                    }
                    .email-signature-form-container .output-section {
                        margin-top: var(--margin-xl);
                    }
                    .email-signature-form-container .output-label {
                         font-size: var(--text-md);
                         font-weight: 600;
                         color: var(--text-color);
                         margin-bottom: var(--margin-sm);
                         text-align: center;
                    }
                    .email-signature-form-container .signature-output-wrapper {
                        padding: var(--padding-lg);
                        background: var(--field-bg); /* Slightly different bg */
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        min-height: 200px;
                        overflow-x: auto;
                        margin-bottom: var(--margin-lg);
                    }
                     /* Style for the initial placeholder text */
                    .email-signature-form-container .signature-output-wrapper p {
                        color: var(--text-muted);
                        text-align: center;
                        margin-top: var(--margin-xl);
                        font-style: italic;
                    }
                    .email-signature-form-container .copy-message {
                        margin-top: var(--margin-sm);
                        font-size: var(--text-sm);
                        color: var(--text-color-success);
                        display: none; /* Hidden by default */
                        text-align: center;
                        height: 20px; /* Reserve space */
                    }
                    /* Japanese Fields Styling */
                    .email-signature-form-container #japanese-fields {
                        width: 100%;
                        gap: var(--margin-lg);
                        flex-wrap: wrap;
                        padding: var(--padding-md); /* Add some padding */
                        background-color: var(--control-bg-on-gray); /* Subtle bg difference */
                        border-radius: var(--border-radius);
                        margin-top: var(--margin-sm);
                        border: 1px solid var(--border-color);
                    }
                    .email-signature-form-container #japanese-fields .form-column {
                        /* Adjust column behavior within JP fields if needed */
                         min-width: 180px; /* Slightly smaller min-width */
                    }
                </style>

                <h2>${__('Clestra Email Signature Generator')}</h2>

                <!-- Division & Footer Selection -->
                <div class="form-section">
                     <div class="form-row">
                        <div class="form-column">
                            <label for="division">${__('Division')}</label>
                            <select id="division" class="form-control"></select>
                        </div>
                         <div class="form-column">
                            <label for="footer-version">${__('Footer Version')}</label>
                            <select id="footer-version" class="form-control">
                                <option value="">${__('None')}</option>
                                <!-- Options populated by JS -->
                            </select>
                        </div>
                     </div>
                </div>

                <!-- User Details -->
                <div class="form-section">
                    <div class="form-row">
                        <div class="form-column">
                            <label for="first_name">${__('First Name')}</label>
                            <input type="text" id="first_name" class="form-control" placeholder="${__('e.g., John')}">
                        </div>
                        <div class="form-column">
                            <label for="last_name">${__('Last Name')}</label>
                            <input type="text" id="last_name" class="form-control" placeholder="${__('e.g., Doe')}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-column">
                            <label for="position">${__('Position')}</label>
                            <input type="text" id="position" class="form-control" placeholder="${__('e.g., Sales Manager')}">
                        </div>
                        <div class="form-column">
                            <label for="team">${__('Team')}</label>
                            <input type="text" id="team" class="form-control" placeholder="${__('e.g., Sales Team')}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-column">
                            <label for="phone_number">${__('Phone Number')}</label>
                            <input type="tel" id="phone_number" class="form-control" placeholder="${__('e.g., +82 2 1234 5678')}">
                        </div>
                        <div class="form-column">
                            <label for="mobile_number">${__('Mobile Number')}</label>
                            <input type="tel" id="mobile_number" class="form-control" placeholder="${__('e.g., +82 10 1234 5678')}">
                        </div>
                    </div>
                </div>

                <!-- Japanese Fields (Hidden by Default) -->
                 <div class="form-section" id="japanese-fields" style="display: none;">
                    <div class="form-row">
                        <div class="form-column">
                            <label for="first_name_jp">${__('First Name (JP)')}</label>
                            <input type="text" id="first_name_jp" class="form-control" placeholder="${__('例：太郎')}">
                        </div>
                         <div class="form-column">
                            <label for="last_name_jp">${__('Last Name (JP)')}</label>
                            <input type="text" id="last_name_jp" class="form-control" placeholder="${__('例：山田')}">
                        </div>
                    </div>
                     <div class="form-row">
                         <div class="form-column">
                            <label for="position_jp">${__('Position (JP)')}</label>
                            <input type="text" id="position_jp" class="form-control" placeholder="${__('例：営業部長')}">
                        </div>
                         <div class="form-column">
                            <label for="team_jp">${__('Team (JP)')}</label>
                            <input type="text" id="team_jp" class="form-control" placeholder="${__('例：営業部')}">
                        </div>
                     </div>
                 </div>


                <!-- Actions & Output -->
                <div class="form-section">
                    <div class="button-group">
                        <button id="generate-btn" class="btn btn-primary btn-lg">${__('Generate Signature')}</button>
                    </div>

                    <div class="output-section">
                        <label class="output-label">${__('Signature Preview & Copy')}</label>
                        <div class="signature-output-wrapper" id="signature-output">
                            <p>${__('Fill in the details above and click "Generate Signature".')}</p>
                            <!-- Generated signature will appear here -->
                        </div>
                    </div>

                     <div class="button-group">
                        <button id="copy-btn" class="btn btn-secondary">${__('Copy Signature')}</button>
                        <div id="copy-message" class="copy-message">${__('Signature copied to clipboard!')}</div>
                    </div>
                </div>

            </div>
        </div>
    `;

    page.wrapper.find('.page-content').html(page_html);

    // --- Helper Functions ---
    function setCookie(name, value, days = 7) {
        let expires = "";
        if (days) {
            let date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        // Add SameSite=Lax for modern browsers
        document.cookie = name + "=" + (encodeURIComponent(value) || "") + expires + "; path=/; SameSite=Lax";
    }

    function getCookie(name) {
        let nameEQ = name + "=";
        let ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
        return null;
    }

    function toggleJapaneseFields() {
        // Scope the selectors to the page wrapper
        const $wrapper = page.wrapper;
        const divisionCode = $wrapper.find('#division').val();
        const $jpFieldsContainer = $wrapper.find('#japanese-fields'); // The container section

        if (divisionCode === 'JP') {
            // Use flex display when showing
            $jpFieldsContainer.css('display', 'flex').hide().slideDown('fast');
        } else {
            $jpFieldsContainer.slideUp('fast', function() {
                // Clear fields after animation completes
                 $wrapper.find('#first_name_jp, #last_name_jp, #position_jp, #team_jp').val('');
            });
        }
    }

    function initializeForm() {
        const $wrapper = page.wrapper; // Reference wrapper
        const savedDivision = getCookie('selected_division');
        const $divisionSelect = $wrapper.find('#division');

        if ($divisionSelect.length > 0 && $divisionSelect.find('option').length > 0) {
             if (savedDivision && $divisionSelect.find(`option[value="${savedDivision}"]`).length > 0) {
                 $divisionSelect.val(savedDivision);
             } else if ($divisionSelect.find('option').length > 1) { // Check if there are actual division options, not just placeholder
                 $divisionSelect.val($divisionSelect.find('option:not([disabled]):first').val()); // Select first non-disabled option
             }
        }

        $wrapper.find('#first_name').val(getCookie('first_name') || '');
        $wrapper.find('#last_name').val(getCookie('last_name') || '');
        $wrapper.find('#position').val(getCookie('position') || '');
        $wrapper.find('#team').val(getCookie('team') || '');
        $wrapper.find('#phone_number').val(getCookie('phone_number') || '');
        $wrapper.find('#mobile_number').val(getCookie('mobile_number') || '');
        $wrapper.find('#first_name_jp').val(getCookie('first_name_jp') || '');
        $wrapper.find('#last_name_jp').val(getCookie('last_name_jp') || '');
        $wrapper.find('#position_jp').val(getCookie('position_jp') || '');
        $wrapper.find('#team_jp').val(getCookie('team_jp') || '');

        const savedFooter = getCookie('selected_footer');
        const $footerSelect = $wrapper.find('#footer-version');
         if (savedFooter && $footerSelect.find(`option[value="${savedFooter}"]`).length > 0) {
             $footerSelect.val(savedFooter);
         } else {
              $footerSelect.val(""); // Default to "None"
         }

        toggleJapaneseFields(); // Set initial visibility
    }

    function generateSignature() {
        const $wrapper = page.wrapper;
        const divisionCode = $wrapper.find('#division').val();
        const footerCode = $wrapper.find('#footer-version').val();

        if (!divisionCode) {
            frappe.show_alert({ message: __('Please select a division.'), indicator: 'warning' });
            return;
        }

        const divisionInfo = page.signature_data.divisions[divisionCode];
        const footerInfo = page.signature_data.footers[footerCode];

        if (!divisionInfo) {
             frappe.throw(__("Could not find configuration data for the selected division: {0}", [divisionCode]));
             return;
        }

        const first_name = $wrapper.find('#first_name').val().trim();
        const last_name = $wrapper.find('#last_name').val().trim();
        const position = $wrapper.find('#position').val().trim();
        const team = $wrapper.find('#team').val().trim();
        const phone_number = $wrapper.find('#phone_number').val().trim();
        const mobile_number = $wrapper.find('#mobile_number').val().trim();

        const first_name_jp = $wrapper.find('#first_name_jp').val().trim();
        const last_name_jp = $wrapper.find('#last_name_jp').val().trim();
        const position_jp = $wrapper.find('#position_jp').val().trim();
        const team_jp = $wrapper.find('#team_jp').val().trim();

        // Save input values to cookies
        setCookie('selected_division', divisionCode);
        setCookie('first_name', first_name);
        setCookie('last_name', last_name);
        setCookie('position', position);
        setCookie('team', team);
        setCookie('phone_number', phone_number);
        setCookie('mobile_number', mobile_number);
        setCookie('first_name_jp', first_name_jp);
        setCookie('last_name_jp', last_name_jp);
        setCookie('position_jp', position_jp);
        setCookie('team_jp', team_jp);
        setCookie('selected_footer', footerCode);

        // Prepare data from Doctype
        const companyNameHtml = (divisionInfo.company_name || '').replace(/\n/g, '<br>');
        const addressHtml = (divisionInfo.address || '').replace(/\n/g, '<br>');
        const companyNameRegionHtml = (divisionInfo.company_name_region || '').replace(/\n/g, '<br>');
        const addressRegionHtml = (divisionInfo.address_region || '').replace(/\n/g, '<br>');
        const websiteUrl = divisionInfo.website || '#';

        // Footer details - Use get_url to ensure full path for image
        const footerImageUrl = footerInfo ? (frappe.utils.get_url(footerInfo.image_url) || '') : '';
        const footerLinkUrl = footerInfo ? (footerInfo.link_url || '#') : '#';
        const hasFooter = footerInfo && footerImageUrl;

        let template = '';

        // --- *** IMPORTANT: Added meta charset=utf-8 *** ---
        const header = `
            <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">
            <html>
            <head>
                <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <title>Email Signature</title>
                <style type="text/css">
                    /* Minimal inline styles for email client compatibility */
                    a { color: #465767; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; padding: 0; background-color: #ffffff;}
                    table { border-collapse: separate; } /* Use separate for potential spacing */
                    td { vertical-align: top; line-height: 1.4; } /* Default vertical alignment */
                </style>
            </head>
            <body style="background-color:#ffffff; margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
            <br>
            <div style="background:#fff; display:inline-block; padding:5px; min-width: 420px; vertical-align: top;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background:#fff; border-collapse:separate; table-layout:fixed; max-width:420px; width: 420px;" width="420">
                <tbody>
                <!-- Column definition row (helps some clients) -->
                <tr style="line-height: 0; font-size: 0;">
                    <td width="25" style="width:25px;"></td><td width="18" style="width:18px;"></td><td width="174" style="width:169px;"></td><td width="18" style="width:18px;"></td><td width="90" style="width:90px;"></td><td width="80" style="width:80px;"></td>
                </tr>
                <!-- Separator -->
                <tr>
                    <td colspan="6" style="height:10px; padding-bottom:10px; line-height: 0;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/filet.png" srcset="https://www.clestra.com/comm/signatures/reymann/filet@2x.png 2x" width="420" height="10" style="display:block; border:0px; max-width: 100%; height: auto;" border="0" alt="" />
                    </td>
                </tr>
                <!-- Main content row -->
                <tr>
                    <!-- Left deco image -->
                    <td rowspan="6" align="left" style="vertical-align:bottom; text-align:left; padding-bottom:3px; line-height: 0;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/deco.png" srcset="https://www.clestra.com/comm/signatures/reymann/deco@2x.png 2x" width="25" style="display:block; border:0px; height:auto; max-height:205px;" border="0" alt="" />
                    </td>`; // rowspan adjusted later

        const contactInfo = `
                <!-- Phone & Mobile Row -->
                <tr>
                    <!-- Phone Icon -->
                    <td align="left" style="height:18px; width:18px; text-align:left; vertical-align: middle; padding-right: 8px; line-height: 0;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/picto-tel.png" srcset="https://www.clestra.com/comm/signatures/reymann/picto-tel@2x.png 2x" width="18" height="18" style="display:inline-block; border:0px; vertical-align: middle;" border="0" alt="Tel" />
                    </td>
                    <!-- Phone Number -->
                    <td style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:10pt; line-height:16px; mso-line-height-rule:exactly; padding:0; vertical-align: middle;">
                        ${phone_number ? `<a href="tel:${phone_number.replace(/\s|-/g, '')}" style="color:#465767; text-decoration:none !important;"><span style="color:#465767; text-decoration:none; font-weight:bold;">${phone_number}</span></a>` : ' '}
                    </td>
                    <!-- Mobile Icon -->
                    <td align="left" style="height:18px; width:18px; text-align:left; vertical-align: middle; padding-right: 8px; line-height: 0;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/picto-cel.png" srcset="https://www.clestra.com/comm/signatures/reymann/picto-cel@2x.png 2x" width="18" height="18" style="display:inline-block; border:0px; vertical-align: middle;" border="0" alt="Mobile" />
                    </td>
                    <!-- Mobile Number -->
                    <td colspan="2" style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:10pt; line-height:16px; mso-line-height-rule:exactly; padding:0; vertical-align: middle;">
                         ${mobile_number ? `<a href="tel:${mobile_number.replace(/\s|-/g, '')}" style="color:#465767; text-decoration:none !important;"><span style="color:#465767; text-decoration:none; font-weight:bold;">${mobile_number}</span></a>` : ' '}
                    </td>
                </tr>
                <!-- Spacer row -->
                <tr style="line-height: 0;">
                    <td colspan="5" height="22" style="height:22px; line-height: 0; font-size: 0;"> </td>
                </tr>
                <!-- Logo row -->
                <tr>
                    <td colspan="5" align="left" style="height:45px; text-align:left; padding-bottom:10px; line-height: 0;">
                        <a href="${websiteUrl}" style="border:0px; display:block; text-decoration: none;" target="_blank">
                            <img src="https://www.clestra.com/comm/signatures/reymann/logo-clestra.png" srcset="https://www.clestra.com/comm/signatures/reymann/logo-clestra@2x.png 2x" width="260" height="45" style="display:block; border:0px; max-width: 100%; height: auto;" border="0" alt="Clestra" />
                        </a>
                    </td>
                </tr>`;

        const footerSection = `
                <!-- Social media bar -->
                <tr style="background-color:#465767;">
                    <td colspan="6" align="left" style="height:30px; text-align:left; line-height: 0; font-size: 0; white-space: nowrap;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/footer-deco.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-deco@2x.png 2x" width="25" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" alt="" /><!--
                        --><a href="${websiteUrl}" style="border:0px; display:inline-block; vertical-align: middle; text-decoration: none;" target="_blank"><img src="https://www.clestra.com/comm/signatures/reymann/footer-site.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-site@2x.png 2x" width="233" height="30" style="display:inline-block; border:0px;" border="0" alt="Clestra Website" /></a><!--
                        --><a href="https://www.facebook.com/clestra.corporate" style="border:0px; display:inline-block; vertical-align: middle; text-decoration: none;" target="_blank"><img src="https://www.clestra.com/comm/signatures/reymann/footer-rs-facebook.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-rs-facebook@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px;" border="0" alt="Facebook" /></a><!--
                        --><a href="https://www.youtube.com/channel/UCkUfm2A1bobvKHA4MzVmfng" style="border:0px; display:inline-block; vertical-align: middle; text-decoration: none;" target="_blank"><img src="https://www.clestra.com/comm/signatures/reymann/footer-rs-youtube.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-rs-youtube@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px;" border="0" alt="YouTube" /></a><!--
                        --><a href="https://www.pinterest.co.kr/clestra" style="border:0px; display:inline-block; vertical-align: middle; text-decoration: none;" target="_blank"><img src="https://www.clestra.com/comm/signatures/reymann/footer-rs-pinterest.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-rs-pinterest@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px;" border="0" alt="Pinterest" /></a><!--
                        --><a href="https://www.linkedin.com/company/clestra-hauserman/" style="border:0px; display:inline-block; vertical-align: middle; text-decoration: none;" target="_blank"><img src="https://www.clestra.com/comm/signatures/reymann/footer-rs-linkedin.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-rs-linkedin@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px;" border="0" alt="LinkedIn" /></a><!--
                        --><a href="https://www.instagram.com/clestra_asia/" style="border:0px; display:inline-block; vertical-align: middle; text-decoration: none;" target="_blank"><img src="https://www.clestra.com/comm/signatures/reymann/footer-rs-instagram.png" srcset="https://www.clestra.com/comm/signatures/reymann/footer-rs-instagram@2x.png 2x" width="34" height="30" style="display:inline-block; border:0px;" border="0" alt="Instagram" /></a>
                    </td>
                </tr>
                <!-- Optional Footer Image section -->
                ${hasFooter ? `
                <tr style="line-height: 0;">
                    <td colspan="6" height="3" style="height:3px; line-height: 0; font-size: 0;"> </td>
                </tr>
                <tr>
                    <td colspan="6" style="width:420px; padding-bottom:10px; text-align: left; line-height: 0;">
                        <a href="${footerLinkUrl}" style="border:0px; display:inline-block; text-decoration: none;" target="_blank">
                            <img src="${footerImageUrl}" width="420" style="display:block; border:0px; max-width: 100%; height: auto;" border="0" alt="${footerInfo.label || 'Footer Image'}" />
                        </a>
                    </td>
                </tr>
                <tr style="line-height: 0;">
                    <td colspan="6" height="10" style="height:10px; line-height: 0; font-size: 0;"> </td>
                </tr>
                ` : '<tr height="0" style="line-height: 0; font-size: 0;"><td colspan="6"></td></tr>'}
                </tbody>
            </table>
            </div><!-- End Main container -->
            </body>
            </html>
        `;

        // --- Template Specific Sections ---
        if (divisionCode === 'JP') {
             const jpHeader = header.replace('rowspan="6"', 'rowspan="7"'); // Adjust rowspan for JP
             template = jpHeader + `
                 <!-- Name (EN) -->
                 <td colspan="2" style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:12pt; line-height:18px; mso-line-height-rule:exactly; padding-bottom:5px; vertical-align: top;">
                    <strong style="font-weight: bold;">${first_name} <span style="text-transform:uppercase;">${last_name}</span></strong>
                 </td>
                 <!-- Name (JP) - Using Meiryo or system default sans-serif for JP -->
                 <td colspan="3" style="color:#465767; font-family: Meiryo, 'Hiragino Sans', 'MS PGothic', sans-serif; font-size:12pt; line-height:18px; mso-line-height-rule:exactly; padding-bottom:5px; vertical-align: top;">
                    <strong style="font-weight: bold;">${last_name_jp} ${first_name_jp}</strong>
                 </td>
                </tr>
                <tr>
                 <!-- Position/Team (EN) -->
                 <td colspan="2" style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:10pt; line-height:14px; mso-line-height-rule:exactly; padding-bottom:8px; vertical-align: top;">
                    <span style="color:#465767;">${position}${team ? ` / <em>${team}</em>` : ''}</span>
                 </td>
                 <!-- Position/Team (JP) -->
                 <td colspan="3" style="color:#465767; font-family: Meiryo, 'Hiragino Sans', 'MS PGothic', sans-serif; font-size:10pt; line-height:14px; mso-line-height-rule:exactly; padding-bottom:8px; vertical-align: top;">
                    <span style="color:#465767;">${position_jp}${team_jp ? ` / <em>${team_jp}</em>` : ''}</span>
                 </td>
                </tr>`
                + contactInfo +
                `<!-- Address Row -->
                 <tr>
                    <!-- Map Icon -->
                    <td align="left" valign="top" style="height:18px; width:18px; text-align:left; vertical-align:top; padding-top: 2px; line-height: 0;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/picto-map.png" srcset="https://www.clestra.com/comm/signatures/reymann/picto-map@2x.png 2x" width="18" height="18" style="display:inline-block; border:0px;" border="0" alt="Address" />
                    </td>
                    <!-- Address (EN) -->
                    <td width="174" colspan="1" valign="top" style="vertical-align:top; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:9pt; line-height:14px; mso-line-height-rule:exactly; padding:0 0 0 8px;">
                        <strong style="font-size: 10pt; font-weight: bold;">${companyNameHtml}</strong><br>
                        ${addressHtml}
                    </td>
                    <!-- Address (JP) -->
                    <td colspan="3" valign="top" style="vertical-align:top; color:#465767; font-family:Meiryo, 'Hiragino Sans', 'MS PGothic', sans-serif; font-size:9pt; line-height:14px; mso-line-height-rule:exactly; padding:0 0 0 8px;">
                        <strong style="font-size: 10pt; font-weight: bold;">${companyNameRegionHtml}</strong><br>
                        ${addressRegionHtml}
                    </td>
                 </tr>`
                + footerSection;
        } else { // Default template
             const defaultHeader = header.replace('rowspan="6"', 'rowspan="6"');
             template = defaultHeader + `
                 <!-- Name -->
                 <td colspan="5" style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:12pt; line-height:18px; mso-line-height-rule:exactly; padding-bottom:5px; vertical-align: top;">
                    <strong style="font-weight: bold;">${first_name} <span style="text-transform:uppercase;">${last_name}</span></strong>
                 </td>
                </tr>
                <tr>
                 <!-- Position/Team -->
                 <td colspan="5" style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:10pt; line-height:14px; mso-line-height-rule:exactly; padding-bottom:8px; vertical-align: top;">
                    <span style="color:#465767;">${position}${team ? ` / <em>${team}</em>` : ''}</span>
                 </td>
                </tr>`
                + contactInfo +
                `<!-- Address Row -->
                 <tr>
                    <!-- Map Icon -->
                    <td align="left" valign="top" style="height:18px; width:18px; text-align:left; vertical-align:top; padding-top: 2px; line-height: 0;">
                        <img src="https://www.clestra.com/comm/signatures/reymann/picto-map.png" srcset="https://www.clestra.com/comm/signatures/reymann/picto-map@2x.png 2x" width="18" height="18" style="display:inline-block; border:0px;" border="0" alt="Address" />
                    </td>
                    <!-- Address -->
                    <td colspan="4" valign="top" style="vertical-align:top; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:9pt; line-height:16px; mso-line-height-rule:exactly; padding:0 0 0 8px;">
                       <strong style="font-size: 10pt; font-weight: bold;">${companyNameHtml}</strong><br>
                       ${addressHtml}
                    </td>
                 </tr>`
                + footerSection;
        }

        $wrapper.find('#signature-output').html(template); // Inject the generated HTML
    }

    function copySignature() {
        const signatureOutputDiv = document.getElementById('signature-output');
        if (!signatureOutputDiv) {
            console.error("Signature output element not found.");
            return;
        }
        const elementToCopy = signatureOutputDiv.querySelector('div[style*="display:inline-block"]');

        if (!elementToCopy || signatureOutputDiv.querySelector('p')) {
            frappe.show_alert({ message: __('Please generate a signature first.'), indicator: 'warning' });
            return;
        }

        const range = document.createRange();
        range.selectNodeContents(elementToCopy);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        try {
            const successful = document.execCommand('copy');
            const msg = successful ? __('Signature copied to clipboard!') : __('Automatic copy failed. Please copy manually.');
            const indicator = successful ? 'green' : 'red';

            frappe.show_alert({ message: msg, indicator: indicator }, 5); // Show Frappe alert

            // Also update local message if needed
            const $copyMessage = page.wrapper.find('#copy-message');
            $copyMessage.text(msg).css('color', `var(--text-color-${indicator === 'green' ? 'success' : 'danger'})`).fadeIn();
            setTimeout(() => { $copyMessage.fadeOut(); }, 3000);

        } catch (err) {
             console.error("Copy failed:", err);
             frappe.show_alert({ message: __('Could not copy signature. Error: {0}', [err]), indicator: 'red' });
        } finally {
             if (selection) {
                 selection.removeAllRanges();
             }
        }
    }

    // --- Fetch Data and Initialize ---
    frappe.call({
        // *** ===>>> IMPORTANT: Verify this path matches YOUR app and function location <<<=== ***
        method: "clestra_app.clestra_app.page.email_signature.email_signature.get_signature_options",
        callback: function(r) {
             const $wrapper = page.wrapper; // Use wrapper scope
            if (r.message && !r.message.error) {
                const data = r.message;
                const $divisionSelect = $wrapper.find('#division');
                const $footerSelect = $wrapper.find('#footer-version');

                $divisionSelect.empty();
                $footerSelect.find('option[value!=""]').remove(); // Keep "None"

                // Populate Divisions
                if (data.divisions && data.divisions.length > 0) {
                    data.divisions.forEach(div => {
                        $divisionSelect.append(new Option(div.label, div.code));
                        page.signature_data.divisions[div.code] = div;
                    });
                     $divisionSelect.prop('disabled', false); // Enable select
                } else {
                     $divisionSelect.append(new Option(__('No divisions configured'), '', true, true)); // Disabled placeholder
                     $divisionSelect.prop('disabled', true);
                }

                // Populate Footers
                if (data.footers && data.footers.length > 0) {
                    data.footers.forEach(foot => {
                        // Ensure image_url is correctly processed (already done in Python with get_url)
                        page.signature_data.footers[foot.code] = foot;
                        $footerSelect.append(new Option(foot.label, foot.code));
                    });
                     $footerSelect.prop('disabled', false); // Enable select
                } else {
                    $footerSelect.prop('disabled', true); // Disable if no footers
                }

                // Initialize form fields AFTER options are added
                initializeForm();

                // Enable buttons if divisions are available
                if (data.divisions && data.divisions.length > 0) {
                     $wrapper.find('#generate-btn, #copy-btn').prop('disabled', false);
                } else {
                     $wrapper.find('#generate-btn, #copy-btn').prop('disabled', true);
                }

            } else {
                // Handle errors during data fetching
                frappe.msgprint({
                    title: __('Error Loading Configuration'),
                    indicator: 'red',
                    message: (r.message && r.message.error) ? r.message.error : __('Could not load signature options. Check setup and logs.')
                });
                $wrapper.find('input, select, button').prop('disabled', true); // Disable everything
            }
        },
        error: function(r) {
            console.error("AJAX Error fetching signature options:", r);
             frappe.msgprint({
                title: __('Server Error'),
                indicator: 'red',
                message: __('Failed to communicate with server. Please check connection or logs.')
            });
             page.wrapper.find('input, select, button').prop('disabled', true);
        }
    });

    // --- Event Listeners (scoped to page wrapper) ---
    page.wrapper.on('change', '#division', toggleJapaneseFields);
    page.wrapper.on('click', '#generate-btn', generateSignature);
    page.wrapper.on('click', '#copy-btn', copySignature);

    // Disable buttons initially
    page.wrapper.find('#generate-btn, #copy-btn').prop('disabled', true);

}; // End of on_page_load