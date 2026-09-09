export interface DepartmentContactInfo {
  departmentName: string;
  officerName: string;
  designation: string;
  email: string;
  phoneNumber: string;
  officeLocation?: string;
  updatedAt?: string;
}

export const getDepartmentDefaultContact = (deptName: string): DepartmentContactInfo => {
  const d = (deptName || '').toLowerCase().trim();
  
  if (d.includes('hostel')) {
    const isBoys = d.includes('boys');
    const isGirls = d.includes('girls');
    return {
      departmentName: deptName,
      officerName: isBoys ? 'Chief Warden (Boys Hostels)' : isGirls ? 'Chief Warden (Girls Hostels)' : 'Chief Warden',
      designation: 'Chief Warden / Hostel In-Charge',
      email: isBoys ? 'warden.boys@rgukt.ac.in' : isGirls ? 'warden.girls@rgukt.ac.in' : 'hostel.warden@rgukt.ac.in',
      phoneNumber: '+91 8588-283620',
      officeLocation: 'Hostel Administration Wing, Student Amenities Block'
    };
  }
  if (d === 'dsw') {
    return {
      departmentName: 'Dean of Student Welfare (DSW)',
      officerName: 'Dean of Student Welfare',
      designation: 'Dean of Student Welfare (DSW)',
      email: 'dsw@rgukt.ac.in',
      phoneNumber: '+91 8588-283621',
      officeLocation: 'DSW Office, Academic Block-1, 1st Floor'
    };
  }
  if (d === 'sports') {
    return {
      departmentName: 'Sports & Physical Education',
      officerName: 'Sports Officer',
      designation: 'Physical Director / Sports Officer',
      email: 'sports@rgukt.ac.in',
      phoneNumber: '+91 8588-283622',
      officeLocation: 'Indoor Sports Complex, Ground Floor'
    };
  }
  if (d === 'physics lab') {
    return {
      departmentName: 'Physics Laboratory',
      officerName: 'Physics Lab In-Charge',
      designation: 'Physics Lab Coordinator',
      email: 'physics.lab@rgukt.ac.in',
      phoneNumber: '+91 8588-283623',
      officeLocation: 'Science Block, Ground Floor Lab 002'
    };
  }
  if (d === 'chemistry lab') {
    return {
      departmentName: 'Chemistry Laboratory',
      officerName: 'Chemistry Lab In-Charge',
      designation: 'Chemistry Lab Coordinator',
      email: 'chemistry.lab@rgukt.ac.in',
      phoneNumber: '+91 8588-283624',
      officeLocation: 'Science Block, 1st Floor Lab 105'
    };
  }
  if (d === 'biology lab') {
    return {
      departmentName: 'Biology Laboratory',
      officerName: 'Biology Lab In-Charge',
      designation: 'Biology Lab Coordinator',
      email: 'biology.lab@rgukt.ac.in',
      phoneNumber: '+91 8588-283625',
      officeLocation: 'Science Block, 1st Floor Lab 108'
    };
  }
  if (d.startsWith('lab technician') || d === 'engg labs') {
    return {
      departmentName: deptName,
      officerName: 'Lab Technician / In-Charge',
      designation: 'Engineering Labs Technician',
      email: 'engg.labs@rgukt.ac.in',
      phoneNumber: '+91 8588-283626',
      officeLocation: 'Engineering Labs Complex'
    };
  }
  if (d === 'coe') {
    return {
      departmentName: 'Controller of Examinations (COE)',
      officerName: 'Controller of Examinations',
      designation: 'Controller of Examinations (COE)',
      email: 'coe@rgukt.ac.in',
      phoneNumber: '+91 8588-283627',
      officeLocation: 'Examination Section, Administrative Building'
    };
  }
  if (d.startsWith('hod') || d.includes('head of department')) {
    return {
      departmentName: deptName,
      officerName: 'Head of Department',
      designation: 'Head of Department (HOD)',
      email: 'hod@rgukt.ac.in',
      phoneNumber: '+91 8588-283628',
      officeLocation: 'Department Faculty Block, HOD Office'
    };
  }
  if (d === 'library') {
    return {
      departmentName: 'Central Library',
      officerName: 'Chief Librarian',
      designation: 'Chief Librarian / Library Officer',
      email: 'library@rgukt.ac.in',
      phoneNumber: '+91 8588-283629',
      officeLocation: 'Central Library Building, Ground Floor Helpdesk'
    };
  }
  if (d === 'it infra') {
    return {
      departmentName: 'IT Infrastructure & Networking',
      officerName: 'Network Administrator',
      designation: 'IT Infrastructure Officer',
      email: 'itinfra@rgukt.ac.in',
      phoneNumber: '+91 8588-283630',
      officeLocation: 'Data Center & IT Complex, 1st Floor'
    };
  }
  if (d === 'scholarship office' || d.includes('scholarship')) {
    return {
      departmentName: 'Scholarship Office',
      officerName: 'Scholarship Officer',
      designation: 'Scholarship & Welfare Section Officer',
      email: 'scholarship@rgukt.ac.in',
      phoneNumber: '+91 8588-283631',
      officeLocation: 'Administrative Building, Room 104'
    };
  }
  if (d === 'fo' || d.includes('finance') || d.includes('account')) {
    return {
      departmentName: 'Finance Office (FO)',
      officerName: 'Finance Officer',
      designation: 'Finance Officer (FO)',
      email: 'fo@rgukt.ac.in',
      phoneNumber: '+91 8588-283632',
      officeLocation: 'Finance & Accounts Branch, Administrative Block'
    };
  }
  if (d === 'ao') {
    return {
      departmentName: 'Administrative Office (AO)',
      officerName: 'Administrative Officer',
      designation: 'Administrative Officer (AO)',
      email: 'ao@rgukt.ac.in',
      phoneNumber: '+91 8588-283633',
      officeLocation: 'Administrative Office, Main Campus Building'
    };
  }
  if (d === 'director') {
    return {
      departmentName: 'Director Office',
      officerName: 'Campus Director',
      designation: 'Campus Director',
      email: 'director@rgukt.ac.in',
      phoneNumber: '+91 8588-283634',
      officeLocation: "Director's Secretariat, Executive Wing"
    };
  }
  if (d === 'dean of academics' || d.includes('dean')) {
    return {
      departmentName: 'Dean of Academics',
      officerName: 'Dean of Academic Affairs',
      designation: 'Dean of Academics',
      email: 'academics@rgukt.ac.in',
      phoneNumber: '+91 8588-283635',
      officeLocation: 'Academic Affairs Section, Admin Block 2nd Floor'
    };
  }

  return {
    departmentName: deptName,
    officerName: 'Department In-Charge',
    designation: 'Department Authority',
    email: `${deptName.toLowerCase().replace(/[^a-z0-9]/g, '')}@rgukt.ac.in`,
    phoneNumber: '+91 8588-283600',
    officeLocation: 'RGUKT Campus Office'
  };
};

export const resolveDepartmentContact = (
  deptName: string,
  deptProfiles: Record<string, any> = {}
): DepartmentContactInfo => {
  const def = getDepartmentDefaultContact(deptName);
  if (!deptName) return def;

  const normalized = deptName.trim().toLowerCase();
  
  // Search in deptProfiles
  const matchedKey = Object.keys(deptProfiles).find(k => {
    const kn = k.trim().toLowerCase();
    if (kn === normalized) return true;
    const prof = deptProfiles[k];
    if (prof?.departmentName && prof.departmentName.trim().toLowerCase() === normalized) return true;
    return false;
  });

  const custom = matchedKey ? deptProfiles[matchedKey] : (deptProfiles[deptName] || null);

  if (!custom) return def;

  return {
    departmentName: custom.departmentName || def.departmentName,
    officerName: (custom.officerName || custom.name || custom.wardenName || def.officerName).trim(),
    designation: (custom.designation || def.designation).trim(),
    email: (custom.email || def.email).trim(),
    phoneNumber: (custom.phoneNumber || custom.phone || def.phoneNumber).trim(),
    officeLocation: (custom.officeLocation || def.officeLocation || '').trim(),
    updatedAt: custom.updatedAt
  };
};
