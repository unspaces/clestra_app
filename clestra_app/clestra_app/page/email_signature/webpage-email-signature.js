// Moved division data outside function to be globally accessible if needed
const divisionData = {
    KR: {
        address: "11F, DMC Digital Cube Building, 34 Sangamsan-ro, Mapo-gu, Seoul, 03909, South Korea",
        company_name: "CLESTRA HAUSERMAN",
        linkclestra: "https://www.clestra.com/kr"
    },
    Gumi: {
        address: "20 Okgye 2-gongdan-ro, Gumi-si, Gyeongsangbuk-do, 39425, South Korea",
        company_name: "CLESTRA HAUSERMAN",
        linkclestra: "https://www.clestra.com/kr"
    },
    HK: {
        address: "Suites 1301-2, 13/F, 1063 King's Road, Quarry Bay, Hong Kong",
        company_name: "CLESTRA LIMITED",
        linkclestra: "https://en.clestra.com/"
    },
    SG: {
        address: "60 Paya Lebar Road, #05-17 Paya Lebar Square Lobby 1, Singapore 409051",
        company_name: "CLESTRA LIMITED SINGAPORE BRANCH",
        linkclestra: "https://en.clestra.com/"
    },
    CN_SH: {
        address: "Room 1004-5, Bldg. E, 31 Lane 168, Daduhe Rd., Putuo District, Shanghai, 2000062, China",
        company_name: "Clestra Hauserman(Taicang) Architecture Product",
        linkclestra: "https://www.clestra.com/cn"
    },
    CN_TC: {
        address: "Building 3, No.199 Wuyang Road,\nChenxiang Town,Taicang City, Jiangsu Province",
        company_name: "Clestra Hauserman (Taicang) Architectural Products Co., Ltd",
        linkclestra: "https://www.clestra.com/cn"
    },
    JP: {
        address: "Akasaka HM Bldg.3F,\n3-7-13 Akasaka, Minato-ku,\nTokyo 107-0052 Japan",
        address_regional: "〒107-0052\n東京都港区赤坂3-7-13\n赤坂HMビル3F", // Use regional field
        company_name: "CLESTRA K.K.",
        company_name_regional: "クレストラ株式会社", // Use regional field
        linkclestra: "https://www.clestra.com/jp"
    },
    MUM: {
        address: "Gat No-95/8, Village-Kuruli, Tal-Khed, Dist-Pune 410501, India",
        company_name: "Clestra Hauserman Wall Systems",
        linkclestra: "https://en.clestra.com/"
    },
    PUN: {
        address: "Gat No-95/8, Village-Kuruli, Tal-Khed, Dist-Pune 410501, India",
        company_name: "Clestra Hauserman Wall Systems",
        linkclestra: "https://en.clestra.com/"
    },
};

// Function to handle the regional details toggle switch change
function handleRegionalToggle() {
    const regionalToggle = document.getElementById('regional-details-toggle');
    const regionalFieldsDiv = document.getElementById('regional-fields');
    const isChecked = regionalToggle.checked;

    regionalFieldsDiv.style.display = isChecked ? 'block' : 'none';

    // Clear fields if toggle is turned off
    if (!isChecked) {
        clearRegionalFields();
    }
}

// Function to clear regional fields
function clearRegionalFields() {
    document.getElementById('first_name_regional').value = '';
    document.getElementById('last_name_regional').value = '';
    document.getElementById('position_regional').value = '';
    document.getElementById('team_regional').value = '';
    document.getElementById('address_regional').value = '';
    document.getElementById('company_name_regional').value = '';
}

// Function to handle division dropdown change
function handleDivisionChange() {
    const division = document.getElementById('division').value;
    const regionalToggle = document.getElementById('regional-details-toggle');
    const disclaimerToggle = document.getElementById('disclaimer-toggle');
    const divisionInfo = divisionData[division]; // Get data for selected division

    // Save the selected division to cookie when changed
    document.cookie = `division=${encodeURIComponent(division)}; path=/; max-age=31536000; SameSite=Lax`; // Expires in 1 year

    // Check if the selected division is Tokyo (JP)
    if (division === 'JP') {
        regionalToggle.checked = true; // Turn the toggle ON
        // Pre-fill regional address/company from data if available
        document.getElementById('address_regional').value = divisionInfo?.address_regional || '';
        document.getElementById('company_name_regional').value = divisionInfo?.company_name_regional || '';

        if(disclaimerToggle) disclaimerToggle.checked = true;

    } else {
        regionalToggle.checked = false; // Turn the toggle OFF for other divisions
        // Don't clear user-input regional fields here automatically,
        // only clear if toggle is manually turned off (handled in handleRegionalToggle)
        // or if we reload the page (handled in initializePage if needed).
        if(disclaimerToggle) disclaimerToggle.checked = false; 
    }

    // Update the visibility based on the new toggle state
    handleRegionalToggle();
}


function isBannerExpired() {
    // 제한 날짜 설정: 2026년 2월 20일 23시 59분 59초
    const expirationDate = new Date('2026-02-20T23:59:59'); 
    const currentDate = new Date();
    
    // 현재 시간이 제한 날짜보다 크면 true(만료됨) 반환
    return currentDate > expirationDate;
}


// Initialize page
function initializePage() {
    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
        const [key, value] = cookie.split('=');
        if (key && value) {
            try {
                acc[key.trim()] = decodeURIComponent(value);
            } catch (e) {
                console.error(`Error decoding cookie: ${key}=${value}`, e);
                acc[key.trim()] = value;
            }
        }
        return acc;
    }, {});

    // Set Division first, as it affects other fields/toggles
    const division = cookies.division || document.getElementById('division').value;
    document.getElementById('division').value = division;

    // Populate standard fields from cookies
    document.getElementById('first_name').value = cookies.first_name || '';
    document.getElementById('last_name').value = cookies.last_name || '';
    document.getElementById('position').value = cookies.position || '';
    document.getElementById('team').value = cookies.team || '';
    document.getElementById('phone_number').value = cookies.phone_number || '';
    document.getElementById('mobile_number').value = cookies.mobile_number || '';

    // Populate regional fields from cookies
    document.getElementById('first_name_regional').value = cookies.first_name_regional || '';
    document.getElementById('last_name_regional').value = cookies.last_name_regional || '';
    document.getElementById('position_regional').value = cookies.position_regional || '';
    document.getElementById('team_regional').value = cookies.team_regional || '';
    document.getElementById('address_regional').value = cookies.address_regional || '';
    document.getElementById('company_name_regional').value = cookies.company_name_regional || '';


    // Initialize toggle state (optional, consider if user preference should persist)
    // const savedVersionToggleState = cookies.version_toggle === 'true';
    // document.getElementById('version-toggle').checked = savedVersionToggleState;
    // isnewyeargreetings = savedVersionToggleState;

    // Set initial state of Regional Toggle based on loaded division
    handleDivisionChange(); // This will set the toggle and visibility correctly

    const toggleContainer = document.getElementById('version-toggle-container');
    const versionToggle = document.getElementById('version-toggle');


    // [추가] 만료일이 지났으면 배너 토글 버튼 자체를 숨김
    if (isBannerExpired()) {
        if (toggleContainer) toggleContainer.style.display = 'none';
        versionToggle.checked = false;
        isnewyeargreetings = false;
    } else {
        // 2. 만료되지 않은 경우: 보이고, **기본으로 체크(ON)**
        if (toggleContainer) toggleContainer.style.display = 'flex';
        
        // 여기에 true를 주어 기본적으로 켜지게 합니다.
        versionToggle.checked = true;
        isnewyeargreetings = true; 
    }

    // 쿠키에 저장된 정보가 있다면, 로드하자마자 서명을 생성해서 미리보기를 보여줌
    if (cookies.first_name) {
    generateSignature();
    }
}

let isnewyeargreetings = true; // Default state

function toggleVersion() {
    const toggle = document.getElementById('version-toggle');
    isnewyeargreetings = toggle.checked;
    // Optional: Save toggle state to cookie
    // document.cookie = `version_toggle=${isnewyeargreetings}; path=/; max-age=31536000; SameSite=Lax`;

    // Regenerate signature if already generated to reflect the change
    if (document.getElementById('signature-output').innerHTML.includes('Clestra')) {
        generateSignature();
    }
}

function generateSignature() {
    const expired = isBannerExpired();

    const useBanner = isnewyeargreetings && !expired;
    const includeDisclaimer = document.getElementById('disclaimer-toggle').checked;

    const imageSrc = useBanner
        ? "https://eclestra.com/files/clestra_newyear_footer_2026.jpg"
        : ""; // No default image if not new year greetings version

    const linkClestraBanner = useBanner
        ? "https://eclestra.com/files/Voeux_2026.mp4"
        : "#"; // Default link if no banner

    const division = document.getElementById('division').value;
    const first_name = document.getElementById('first_name').value.trim();
    const last_name = document.getElementById('last_name').value.trim();
    const position = document.getElementById('position').value.trim();
    const team = document.getElementById('team').value.trim();
    const phone_number = document.getElementById('phone_number').value.trim();
    const mobile_number = document.getElementById('mobile_number').value.trim();

    // Get regional details ONLY if the toggle is checked
    const showRegional = document.getElementById('regional-details-toggle').checked;
    const first_name_regional = showRegional ? (document.getElementById('first_name_regional')?.value.trim() || '') : '';
    const last_name_regional = showRegional ? (document.getElementById('last_name_regional')?.value.trim() || '') : '';
    const position_regional = showRegional ? (document.getElementById('position_regional')?.value.trim() || '') : '';
    const team_regional = showRegional ? (document.getElementById('team_regional')?.value.trim() || '') : '';
    const address_regional = showRegional ? (document.getElementById('address_regional')?.value.trim() || '') : '';
    const company_name_regional = showRegional ? (document.getElementById('company_name_regional')?.value.trim() || '') : '';

    // Basic validation: Ensure at least first name, last name, position are entered
    if (!first_name || !last_name || !position) {
        alert('Please enter at least First Name, Last Name, and Position.');
        document.getElementById('signature-output').innerHTML = '<p style="color: red; text-align: center;">Please fill in the required fields.</p>';
        return;
    }

    const divisionInfo = divisionData[division];
    if (!divisionInfo) {
        console.error("Selected division data not found!");
        alert("Error: Invalid division selected.");
        return;
    }

    // Save input data to cookies (expires in 1 year)
    const cookieOptions = "path=/; max-age=31536000; SameSite=Lax"; // 1 year expiry, Lax security
    document.cookie = `first_name=${encodeURIComponent(first_name)}; ${cookieOptions}`;
    document.cookie = `last_name=${encodeURIComponent(last_name)}; ${cookieOptions}`;
    document.cookie = `position=${encodeURIComponent(position)}; ${cookieOptions}`;
    document.cookie = `team=${encodeURIComponent(team)}; ${cookieOptions}`;
    document.cookie = `phone_number=${encodeURIComponent(phone_number)}; ${cookieOptions}`;
    document.cookie = `mobile_number=${encodeURIComponent(mobile_number)}; ${cookieOptions}`;
    document.cookie = `division=${encodeURIComponent(division)}; ${cookieOptions}`; // Division already saved

    // Save regional fields to cookies (even if toggle is off, to preserve input)
    document.cookie = `first_name_regional=${encodeURIComponent(document.getElementById('first_name_regional').value.trim())}; ${cookieOptions}`;
    document.cookie = `last_name_regional=${encodeURIComponent(document.getElementById('last_name_regional').value.trim())}; ${cookieOptions}`;
    document.cookie = `position_regional=${encodeURIComponent(document.getElementById('position_regional').value.trim())}; ${cookieOptions}`;
    document.cookie = `team_regional=${encodeURIComponent(document.getElementById('team_regional').value.trim())}; ${cookieOptions}`;
    document.cookie = `address_regional=${encodeURIComponent(document.getElementById('address_regional').value.trim())}; ${cookieOptions}`;
    document.cookie = `company_name_regional=${encodeURIComponent(document.getElementById('company_name_regional').value.trim())}; ${cookieOptions}`;

    // --- Signature Template Logic ---
    let template = '';
    const addressHtml = (divisionInfo.address || '').replace(/\n/g, '<br>');
    // Use the input regional address if available and toggle is on, otherwise use data from divisionInfo if JP, else empty
    const addressRegionalHtml = (address_regional ? address_regional.replace(/\n/g, '<br>') : (division === 'JP' ? (divisionInfo.address_regional || '').replace(/\n/g, '<br>') : '') );
    const companyName = divisionInfo.company_name || '';
    // Use the input regional company name if available and toggle is on, otherwise use data from divisionInfo if JP, else empty
    const companyNameRegional = company_name_regional ? company_name_regional : (division === 'JP' ? (divisionInfo.company_name_regional || '') : '');
    const linkClestraWeb = divisionInfo.linkclestra || 'https://www.clestra.com/';

    // Build dynamic parts
    let phoneHtml = phone_number ? `
        <td align="left" style="height:18px; text-align:left; padding-right: 5px; vertical-align: middle;">
            <img src="https://eclestra.com/files/picto-tel.png" srcset="https://eclestra.com/files/picto-tel@2x.png 2x" width="18" height="18" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="P: " />
        </td>
        <td style="width=177px color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:16px; mso-line-height-rule:exactly; padding:0 0 0 8px; width: 177px;">
            <a href="tel:${phone_number.replace(/\s+/g, '')}" style="color:#465767;text-decoration:none;font-weight:bold;" target="_blank">${phone_number}</a>
        </td>` : '<td colspan="2"></td>'; // Empty cells if no phone

    let mobileHtml = mobile_number ? `
        <td align="left" style="height:18px; text-align:left; padding-right: 5px; vertical-align: middle;">
            <img src="https://eclestra.com/files/picto-cel.png" srcset="https://eclestra.com/files/picto-cel@2x.png 2x" width="18" height="18" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="M: " />
        </td>
        <td colspan="2" style="color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:16px; mso-line-height-rule:exactly; padding:0 0 0 0; vertical-align: middle;">
            <a href="tel:${mobile_number.replace(/\s+/g, '')}" style="color:#465767; text-decoration:none; font-weight:bold;" target="_blank">${mobile_number}</a>
        </td>` : '<td colspan="3"></td>'; // Empty cells if no mobile

    const bannerHtml = useBanner ? `
        <tr><td colspan="6" height="10" style="font-size:1px; line-height:1px; height:10px;"> </td></tr>
        <tr>
            <td colspan="6" style="padding:0; margin:0; line-height: 1px;">
                <a href="${linkClestraBanner}" style="border:0px; display:inline-block; line-height: 1px;" target="_blank">
                    <img src="${imageSrc}" width="420" style="display:block; border:0px; max-width: 100%; height: auto;" border="0" nosend="1" alt="Happy New Year" />
                </a>
            </td>
        </tr>
        <tr><td colspan="6" height="10" style="font-size:1px; line-height:1px; height:10px;"> </td></tr>
        ` : '';

    // Disclaimer HTML Block
    const disclaimerHtml = includeDisclaimer ? `
        <tr>
            <td colspan="6" align="left" style="padding-top: 10px; font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 12px; color: #777777;">
                <a href="https://eclestra.com/email-disclaimer-Jp#" style="color: #777777; text-decoration: underline;" target="_blank">Email Disclaimer</a>
            </td>
        </tr>` : '';


    // --- Common Structure Start ---
    let signatureBase = `
    <br>
    <div style="background:#fff; display:inline-block; padding:5px;">
    <table cellspacing="0" cellpadding="0" border="0" style="background:#fff; border-collapse:collapse; table-layout:fixed; width:420px; max-width:420px;" width="420">
        <tbody>
        <tr width="420" style="width:420px;">
            <td width="25" style="width:25px;"></td>
            <td width="18" style="width:18px;"></td>
            <td width="174" style="width:174px;"></td> <!-- Adjusted width -->
            <td width="18" style="width:18px;"></td>
            <td width="90" style="width:90px;"></td>
            <td width="95" style="width:95px;"></td> <!-- Adjusted width -->
        </tr>
        <tr>
            <td colspan="6" style="height:10px; padding-bottom:10px; line-height: 1px;">
                <img src="https://eclestra.com/files/filet.png" srcset="https://eclestra.com/files/filet@2x.png 2x" width="420" height="10" style="display:block; border:0px;" border="0" nosend="1" alt="" />
            </td>
        </tr>
        <tr>
            <td width="25" rowspan="6" align="left" style="width:25px; vertical-align: top; padding-top: 3px;">
                <img src="https://eclestra.com/files/deco.png" srcset="https://eclestra.com/files/deco@2x.png 2x" width="25" height="195" style="display:block; border:0px; height: 195px;" border="0" nosend="1" alt="" />
            </td>
            <!-- Name and Position details will go here -->
            `;

    // --- Name/Position Block (Handles Regional) ---
    if (showRegional && (first_name_regional || last_name_regional || position_regional || team_regional)) {
        // Display side-by-side if regional info exists
        signatureBase += `
            <td colspan="2" style="width: 192px; white-space: nowrap; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:18px; mso-line-height-rule:exactly; padding:0 5px 5px 8px; vertical-align: top;">
                <strong>${first_name} <span style="text-transform:uppercase;">${last_name}</span></strong>
            </td>
            <td colspan="3" style="width: 203px; white-space: nowrap; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:18px; mso-line-height-rule:exactly; padding:0 0 5px 8px; vertical-align: top;">
                <strong>${last_name_regional}${first_name_regional ? ` ${first_name_regional}`: ''}</strong>
            </td>
        </tr>
        <tr>
            <td colspan="2" style="width: 192px; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:14px; mso-line-height-rule:exactly; padding:0 5px 8px 8px; vertical-align: top;">
                <span style="color:#465767;">${position}${team ? ` / <em>${team}</em>` : ''}</span>
            </td>
            <td colspan="3" style="width: 203px; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:14px; mso-line-height-rule:exactly; padding:0 0 8px 8px; vertical-align: top;">
                <span style="color:#465767;">${position_regional}${team_regional ? ` / <em>${team_regional}</em>` : ''}</span>
            </td>
        </tr>`;
    } else {
        // Display standard format only
        signatureBase += `
            <td colspan="5" style="width: 395px; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:16px; line-height:18px; mso-line-height-rule:exactly; padding:0 0 5px 8px; vertical-align: top;">
                <strong>${first_name} <span style="text-transform:uppercase;">${last_name}</span></strong>
            </td>
        </tr>
        <tr>
            <td colspan="5" style="width: 395px; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:14px; mso-line-height-rule:exactly; padding:0 0 8px 8px; vertical-align: top;">
                <span style="color:#465767;">${position}${team ? ` / <em>${team}</em>` : ''}</span>
            </td>
        </tr>`;
    }

    // --- Contact Info Row ---
    signatureBase += `<tr>`; // Start contact row

    if (phone_number) {
        signatureBase += `
            <td align="left" valign="top" style="width: 18px; height: 18px; vertical-align:top; padding: 0 0 0 8px;"> <!-- Col 2: Phone Icon -->
                <img src="https://eclestra.com/files/picto-tel.png" srcset="https://eclestra.com/files/picto-tel@2x.png 2x" width="18" height="18" style="display:block; border:0px; width: 18px; height: 18px; min-width: 18px; vertical-align: top;" border="0" nosend="1" alt="P: " />
            </td>
            <td valign="top" style="width: 174px; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:16px; mso-line-height-rule:exactly; vertical-align: top; padding: 0 8px 0 16px;"> <!-- Col 3: Phone Text (9px left padding) -->
                <a href="tel:${phone_number.replace(/\s+/g, '')}" style="color:#465767;text-decoration:none;font-weight:bold;" target="_blank">${phone_number}</a>
            </td>`;
    } else {
        // Placeholder for columns 2 and 3
        signatureBase += `<td style="width: 18px; padding-left: 8px;"></td><td style="width: 174px; padding: 0 8px 0 16px;"></td>`;
    }

    if (mobile_number) {
        signatureBase += `
            <td align="left" valign="top" style="width: 18px; height: 18px; vertical-align:top; padding: 0 0 0 8px;"> <!-- Col 4: Mobile Icon -->
                <img src="https://eclestra.com/files/picto-cel.png" srcset="https://eclestra.com/files/picto-cel@2x.png 2x" width="18" height="18" style="display:block; border:0px; width: 18px; height: 18px; min-width: 18px; vertical-align: top;" border="0" nosend="1" alt="M: " />
            </td>
            <td colspan="2" valign="top" style="width: 185px; /* 90+95 */ color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:16px; mso-line-height-rule:exactly; vertical-align: top; padding: 0 0 0 16px;"> <!-- Col 5+6: Mobile Text (9px left padding) -->
                <a href="tel:${mobile_number.replace(/\s+/g, '')}" style="color:#465767; text-decoration:none; font-weight:bold;" target="_blank">${mobile_number}</a>
            </td>`;
    } else {
        // Placeholder for columns 4, 5, 6
        signatureBase += `<td style="width: 18px; padding-left: 8px;"></td><td colspan="2" style="width: 185px; padding-left: 9px;"></td>`;
    }

    signatureBase += `</tr>`; // End contact row
    // Ensure spacer row colspan is 6
    signatureBase += `<tr><td colspan="6" height="15" style="font-size:1px; line-height:1px; height:15px;"> </td></tr>
    `;

    // --- Logo Row ---
    signatureBase += `
        <tr>
            <td colspan="5" align="left" style="height:45px; text-align:left; padding:0 0 10px 8px;">
                <a href="${linkClestraWeb}" style="border:0px; display:block;" target="_blank">
                    <img src="https://eclestra.com/files/logo-clestra.png" srcset="https://eclestra.com/files/logo-clestra@2x.png 2x" width="260" height="45" style="display:block; border:0px;" border="0" nosend="1" alt="Clestra" />
                </a>
            </td>
        </tr>`;

    // --- Address Row (Handles Regional) ---
    if (showRegional && addressRegionalHtml && companyNameRegional) {
        // Case 1: Regional address exists
        signatureBase += `
        <tr>
            <td align="left" valign="top" style="width: 18px; height:18px; vertical-align:top; padding: 0 0 0 8px;"> <!-- Col 2: Map Icon -->
                <img src="https://eclestra.com/files/picto-map.png" srcset="https://eclestra.com/files/picto-map@2x.png 2x" width="18" height="18" style="display:block; border:0px; width: 18px; height: 18px; min-width: 18px; vertical-align: top;" border="0" nosend="1" alt="" />
            </td>
            <td valign="top" style="width: 174px; vertical-align:top; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:14px; mso-line-height-rule:exactly; padding: 0 8px 0 16px;"> <!-- Col 3: Main Address (9px left padding) -->
                <strong style="font-size: 13px; line-height: 14px;">${companyName}</strong><br>${addressHtml}
            </td>
            <td style="width: 18px; vertical-align: top; padding: 0 0 0 8px;"></td> <!-- Col 4: Empty Icon Placeholder (must be present for layout) -->
            <td colspan="2" valign="top" style="width: 185px; /* 90+95 */ vertical-align:top; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:14px; mso-line-height-rule:exactly; padding: 0 0 0 16px;"> <!-- Col 5+6: Regional Address (9px left padding after empty Col 4) -->
                <strong style="font-size: 13px; line-height: 14px;">${companyNameRegional}</strong><br>${addressRegionalHtml}
            </td>
        </tr>`;
    } else {
        // Case 2: No regional address
        signatureBase += `
        <tr>
            <td align="left" valign="top" style="width: 18px; height:18px; vertical-align:top; padding: 0 0 0 8px;"> <!-- Col 2: Map Icon -->
                <img src="https://eclestra.com/files/picto-map.png" srcset="https://eclestra.com/files/picto-map@2x.png 2x" width="18" height="18" style="display:block; border:0px; width: 18px; height: 18px; min-width: 18px; vertical-align: top;" border="0" nosend="1" alt="" />
            </td>
            <td colspan="4" valign="top" style="width: 377px; /* Sum of widths Col 3,4,5,6 */ vertical-align:top; color:#465767; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:14px; mso-line-height-rule:exactly; padding: 0 0 0 16px;"> <!-- Col 3-6: Main Address (9px left padding) -->
                <strong style="font-size: 13px; line-height: 14px;">${companyName}</strong><br>${addressHtml}
            </td>
            <!-- Col 1 + Col 2 + Col 3-6 = 6 columns used -->
        </tr>`;
    }

    // --- Footer Row ---
    signatureBase += `
        <tr style="background-color:#465767;">
            <td colspan="6" align="left" style="height:30px; text-align:left; line-height: 1px; font-size: 1px;">
                <img src="https://eclestra.com/files/footer-deco.png" srcset="https://eclestra.com/files/footer-deco@2x.png 2x" width="25" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="" />
                <a href="${linkClestraWeb}" style="border:0px; display:inline-block; text-decoration: none;" target="_blank"><img src="https://eclestra.com/files/footer-site.png" srcset="https://eclestra.com/files/footer-site@2x.png 2x" width="233" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="Clestra Website" /></a>
                <a href="https://www.facebook.com/clestra.corporate" style="border:0px; display:inline-block; text-decoration: none;" target="_blank"><img src="https://eclestra.com/files/footer-rs-facebook.png" srcset="https://eclestra.com/files/footer-rs-facebook@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="Facebook" /></a>
                <a href="https://www.youtube.com/channel/UCkUfm2A1bobvKHA4MzVmfng" style="border:0px; display:inline-block; text-decoration: none;" target="_blank"><img src="https://eclestra.com/files/footer-rs-youtube.png" srcset="https://eclestra.com/files/footer-rs-youtube@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="YouTube" /></a>
                <a href="https://www.pinterest.co.kr/clestra" style="border:0px; display:inline-block; text-decoration: none;" target="_blank"><img src="https://eclestra.com/files/footer-rs-pinterest.png" srcset="https://eclestra.com/files/footer-rs-pinterest@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="Pinterest" /></a>
                <a href="https://www.linkedin.com/company/clestra-hauserman/" style="border:0px; display:inline-block; text-decoration: none;" target="_blank"><img src="https://eclestra.com/files/footer-rs-linkedin.png" srcset="https://eclestra.com/files/footer-rs-linkedin@2x.png 2x" width="27" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="LinkedIn" /></a>
                <a href="https://www.instagram.com/clestra_asia/" style="border:0px; display:inline-block; text-decoration: none;" target="_blank"><img src="https://eclestra.com/files/footer-rs-instagram.png" srcset="https://eclestra.com/files/footer-rs-instagram@2x.png 2x" width="34" height="30" style="display:inline-block; border:0px; vertical-align: middle;" border="0" nosend="1" alt="Instagram" /></a>
            </td>
        </tr>
        <tr><td colspan="6" height="10" style="font-size:1px; line-height:1px; height:10px;"> </td></tr> <!-- Spacer -->
        <!-- Optional Banner -->
        ${bannerHtml}
        ${disclaimerHtml}
        </tbody>
    </table>
    </div>
    `;

    // --- Assemble Final Template ---
    template = `<!DOCTYPE HTML>
    <html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>Clestra Email Signature</title>
        <style>
            /* Minimal styles for email compatibility */
            a { color: #465767; text-decoration: none; }
            strong { font-weight: bold; }
            em { font-style: italic; }
        </style>
    </head>
    <body style="background:#fff; margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; font-size: 12px;">
        ${signatureBase}
    </body>
    </html>`;


    document.getElementById('signature-output').innerHTML = template;
}


function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split('=');
        if (key === name) {
            try {
                return decodeURIComponent(value);
            } catch (e) {
                console.error(`Error decoding cookie: ${name}=${value}`, e);
                return value; // Return raw value if decoding fails
            }
        }
    }
    return null;
}

function copySignature() {
    const signatureElement = document.getElementById('signature-output');
    if (!signatureElement.innerHTML || signatureElement.innerHTML.includes('Please fill in')) {
        alert('Please generate a signature first.');
        return;
    }

    // Use the Clipboard API for modern browsers
    if (navigator.clipboard && window.isSecureContext) {
        // Use the generated HTML directly
        const signatureHTML = signatureElement.innerHTML;
        const blobHTML = new Blob([signatureHTML], { type: 'text/html' });
        // Optionally create a plain text version (might lose formatting)
        // const blobText = new Blob([signatureElement.innerText], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
            'text/html': blobHTML,
            // 'text/plain': blobText // Include if plain text fallback is desired
        });


        navigator.clipboard.write([clipboardItem]).then(() => {
            showCopyMessage();
        }).catch(err => {
            console.error('Async clipboard write failed: ', err);
            // Fallback to execCommand if Clipboard API fails
            fallbackCopy(signatureElement);
        });
    } else {
        // Fallback for older browsers or non-secure contexts
        fallbackCopy(signatureElement);
    }
}

// Fallback copy method using execCommand
function fallbackCopy(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyMessage();
        } else {
            // Try copying the outerHTML as a last resort maybe? Less reliable.
            alert('Failed to copy the signature using fallback method. You might need to select and copy manually.');
        }
    } catch (err) {
        console.error('Fallback copy error:', err);
        alert('Failed to copy the signature.');
    }

    selection.removeAllRanges(); // Deselect
}

function showCopyMessage() {
    const copyMessage = document.getElementById('copy-message');
    copyMessage.style.display = 'block'; // Show the message
    setTimeout(() => {
        copyMessage.style.display = 'none'; // Hide after 2 seconds
    }, 2000);
}


// Page load initialization
window.onload = initializePage;