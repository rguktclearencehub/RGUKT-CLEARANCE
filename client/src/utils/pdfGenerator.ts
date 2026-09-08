import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface DueItem {
  reason: string;
  amount: number;
}

export interface DepartmentDuesGroup {
  department: string;
  subtotal: number;
  items: DueItem[];
}

// Convert amount into Indian currency words format
export function numberToIndianWords(num: number): string {
  if (!num || num <= 0) return 'Zero Rupees Only';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  };

  let n = Math.floor(num);
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  let res = '';
  if (crore > 0) res += inWords(crore) + 'Crore ';
  if (lakh > 0) res += inWords(lakh) + 'Lakh ';
  if (thousand > 0) res += inWords(thousand) + 'Thousand ';
  if (hundred > 0) res += inWords(hundred);

  return 'Rupees ' + res.trim() + ' Only';
}

// Helper to load logo as base64 string
export const getLogoBase64 = async (): Promise<string | null> => {
  try {
    const res = await fetch('/rgukt.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Failed to load RGUKT logo for PDF:', err);
    return null;
  }
};

// Fetch itemized dues breakdown divided by department for any student
export const fetchDetailedStudentDues = async (
  studentId: string,
  requestData?: any
): Promise<{ groups: DepartmentDuesGroup[]; grandTotal: number }> => {
  if (!studentId) return { groups: [], grandTotal: 0 };
  const cleanId = studentId.toUpperCase().trim();

  // 1. Query all penalty collections in parallel
  const [hostelSnap, dswSnap, labSnap, librarySnap, itInfraSnap, scholarshipSnap] = await Promise.all([
    getDocs(query(collection(db, 'hostelPenalties'), where('studentId', '==', cleanId))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'dswPenalties'), where('studentId', '==', cleanId))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'labPenalties'), where('studentId', '==', cleanId))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'libraryPenalties'), where('studentId', '==', cleanId))).catch(() => ({ docs: [] } as any)),
    getDocs(query(collection(db, 'itInfraPenalties'), where('studentId', '==', cleanId))).catch(() => ({ docs: [] } as any)),
    getDoc(doc(db, 'scholarshipRecords', cleanId)).catch(() => null)
  ]);

  const hostelPenalties = hostelSnap.docs.map((d: any) => d.data()).filter((p: any) => p.status !== 'PAID');
  const dswPenalties = dswSnap.docs.map((d: any) => d.data()).filter((p: any) => p.status !== 'PAID');
  const labPenalties = labSnap.docs.map((d: any) => d.data()).filter((p: any) => p.status !== 'PAID');
  const libraryPenalties = librarySnap.docs.map((d: any) => d.data()).filter((p: any) => p.status !== 'PAID');
  const itInfraPenalties = itInfraSnap.docs.map((d: any) => d.data()).filter((p: any) => p.status !== 'PAID');

  // 2. Department clearances list
  let clearanceList: any[] = [];
  if (requestData?.departmentClearances && Array.isArray(requestData.departmentClearances) && requestData.departmentClearances.length > 0) {
    clearanceList = requestData.departmentClearances;
  } else if (requestData?.id) {
    try {
      const dcSnap = await getDocs(query(collection(db, 'departmentClearances'), where('requestId', '==', requestData.id)));
      clearanceList = dcSnap.docs.map((d: any) => d.data());
    } catch (e) {
      console.warn('Could not fetch department clearances by requestId:', e);
    }
  }

  const groups: DepartmentDuesGroup[] = [];

  const addGroup = (department: string, items: DueItem[]) => {
    const validItems = items.filter(i => i.amount > 0);
    if (validItems.length > 0) {
      const subtotal = validItems.reduce((sum, item) => sum + item.amount, 0);
      groups.push({
        department,
        items: validItems,
        subtotal
      });
    }
  };

  const getDeptClearance = (deptPattern: string) => {
    return clearanceList.find((c: any) => {
      const n = (c.departmentName || '').toLowerCase();
      const p = deptPattern.toLowerCase();
      return n.includes(p) || p.includes(n);
    });
  };

  // A. HOSTEL
  const hostelClr = getDeptClearance('Hostel');
  const hostelDeptName = hostelClr?.departmentName || (requestData?.gender === 'Female' ? 'Girls Hostel' : 'Boys Hostel');
  const hostelItems: DueItem[] = [];
  
  if (hostelClr && hostelClr.status !== 'PENDING') {
    if (hostelClr.feeDue > 0) {
      if (hostelClr.penalties && Array.isArray(hostelClr.penalties) && hostelClr.penalties.length > 0) {
        hostelClr.penalties.forEach((p: any) => {
          hostelItems.push({ reason: p.reason || 'Hostel Penalty', amount: Number(p.amount) || 0 });
        });
      }
      const hpSum = hostelItems.reduce((sum, i) => sum + i.amount, 0);
      if (hostelClr.feeDue > hpSum) {
        hostelItems.push({
          reason: hostelClr.remarks && hostelClr.remarks !== 'Pay' && hostelClr.remarks !== 'Dues' ? hostelClr.remarks : 'Room & Facility Maintenance Due',
          amount: hostelClr.feeDue - hpSum
        });
      }
    }
  } else {
    hostelPenalties.forEach((p: any) => {
      hostelItems.push({ reason: p.reason || 'Hostel Penalty / Breakage', amount: Number(p.amount) || 0 });
    });
  }
  if (hostelItems.length > 0) {
    addGroup(hostelDeptName, hostelItems);
  }

  // B. DSW
  const dswClr = getDeptClearance('DSW');
  const dswItems: DueItem[] = [];
  
  if (dswClr && dswClr.status !== 'PENDING') {
    if (dswClr.feeDue > 0) {
      if (dswClr.penalties && Array.isArray(dswClr.penalties) && dswClr.penalties.length > 0) {
        dswClr.penalties.forEach((p: any) => {
          dswItems.push({ reason: p.reason || 'DSW Penalty', amount: Number(p.amount) || 0 });
        });
      }
      const dswSum = dswItems.reduce((sum, i) => sum + i.amount, 0);
      if (dswClr.feeDue > dswSum) {
        dswItems.push({
          reason: dswClr.maintenanceFee ? 'Campus Welfare & Maintenance Fee' : (dswClr.remarks && dswClr.remarks !== 'Dues' ? dswClr.remarks : 'Campus Welfare & Maintenance Due'),
          amount: dswClr.feeDue - dswSum
        });
      }
    }
  } else {
    dswPenalties.forEach((p: any) => {
      dswItems.push({ reason: p.reason || 'DSW Penalty / Disciplinary Charge', amount: Number(p.amount) || 0 });
    });
  }
  if (dswItems.length > 0) {
    addGroup('DSW', dswItems);
  }

  // C. LABS (Chemistry Lab, Physics Lab, Biology Lab, Engg Labs)
  const labNamesSet = new Set<string>();
  labPenalties.forEach((p: any) => {
    if (p.department) labNamesSet.add(p.department);
  });
  clearanceList.forEach((c: any) => {
    if ((c.departmentName || '').toLowerCase().includes('lab') && c.feeDue > 0) {
      labNamesSet.add(c.departmentName);
    }
  });

  labNamesSet.forEach((labDept) => {
    const items: DueItem[] = [];
    const clr = clearanceList.find((c: any) => c.departmentName === labDept);
    
    if (clr && clr.status !== 'PENDING') {
      if (clr.feeDue > 0) {
        if (clr.penalties && Array.isArray(clr.penalties) && clr.penalties.length > 0) {
          clr.penalties.forEach((p: any) => {
            items.push({ reason: p.reason || 'Lab Equipment Breakage', amount: Number(p.amount) || 0 });
          });
        }
        const sum = items.reduce((s, i) => s + i.amount, 0);
        if (clr.feeDue > sum) {
          items.push({
            reason: clr.remarks && clr.remarks !== 'Dues' ? clr.remarks : 'Laboratory Consumables & Breakage Due',
            amount: clr.feeDue - sum
          });
        }
      }
    } else {
      labPenalties.filter((p: any) => p.department === labDept || (!p.department && labDept.includes('Lab'))).forEach((p: any) => {
        items.push({ reason: p.reason || 'Lab Equipment Breakage / Lost Item', amount: Number(p.amount) || 0 });
      });
    }
    if (items.length > 0) {
      addGroup(labDept, items);
    }
  });

  // D. LIBRARY
  const libClr = getDeptClearance('Library');
  const libItems: DueItem[] = [];
  
  if (libClr && libClr.status !== 'PENDING') {
    if (libClr.feeDue > 0) {
      if (libClr.penalties && Array.isArray(libClr.penalties) && libClr.penalties.length > 0) {
        libClr.penalties.forEach((p: any) => {
          libItems.push({ reason: p.reason || 'Library Fine', amount: Number(p.amount) || 0 });
        });
      }
      const libSum = libItems.reduce((sum, i) => sum + i.amount, 0);
      if (libClr.feeDue > libSum) {
        libItems.push({
          reason: libClr.remarks && !libClr.remarks.toLowerCase().includes('pay') ? libClr.remarks : 'Library Overdue Book Charges',
          amount: libClr.feeDue - libSum
        });
      }
    }
  } else {
    libraryPenalties.forEach((p: any) => {
      libItems.push({ reason: p.reason || 'Overdue Book Fine / Replacement Charge', amount: Number(p.amount) || 0 });
    });
  }
  if (libItems.length > 0) {
    addGroup('Library', libItems);
  }

  // E. IT INFRA
  const itClr = getDeptClearance('IT Infra');
  const itItems: DueItem[] = [];
  
  if (itClr && itClr.status !== 'PENDING') {
    if (itClr.feeDue > 0) {
      if (itClr.penalties && Array.isArray(itClr.penalties) && itClr.penalties.length > 0) {
        itClr.penalties.forEach((p: any) => {
          itItems.push({ reason: p.reason || 'IT Equipment Charge', amount: Number(p.amount) || 0 });
        });
      }
      const itSum = itItems.reduce((sum, i) => sum + i.amount, 0);
      if (itClr.feeDue > itSum) {
        itemsPushUnique(itItems, {
          reason: itClr.remarks && !itClr.remarks.toLowerCase().includes('pay') ? itClr.remarks : 'IT Infrastructure & Network Device Due',
          amount: itClr.feeDue - itSum
        });
      }
    }
  } else {
    itInfraPenalties.forEach((p: any) => {
      itItems.push({ reason: p.reason || 'IT Equipment Damage / Accessory Charge', amount: Number(p.amount) || 0 });
    });
  }
  if (itItems.length > 0) {
    addGroup('IT Infra', itItems);
  }

  // F. SCHOLARSHIP OFFICE
  const schClr = getDeptClearance('Scholarship');
  const schItems: DueItem[] = [];
  const schData = (scholarshipSnap && scholarshipSnap.exists()) ? scholarshipSnap.data() : (schClr?.scholarshipDetails || requestData?.scholarshipDetails);
  
  if (schClr && schClr.status !== 'PENDING') {
    if (schClr.feeDue > 0) {
      if (schData?.years && Array.isArray(schData.years)) {
        schData.years.forEach((y: any) => {
          const due = Number(y.due) || 0;
          if (due > 0) {
            schItems.push({
              reason: `${y.name || y.id} - Tuition & Mess Fee Due`,
              amount: due
            });
          }
        });
      }
      const schSum = schItems.reduce((s, i) => s + i.amount, 0);
      if (schClr.feeDue > schSum) {
        schItems.push({
          reason: schClr.remarks && !schClr.remarks.toLowerCase().includes('pay') ? schClr.remarks : 'Pending Tuition & Mess Grant Settlement',
          amount: Number(schClr.feeDue) - schSum
        });
      }
    }
  } else {
    if (schData?.years && Array.isArray(schData.years)) {
      schData.years.forEach((y: any) => {
        const due = Number(y.due) || 0;
        if (due > 0) {
          schItems.push({
            reason: `${y.name || y.id} - Tuition & Mess Fee Due`,
            amount: due
          });
        }
      });
    }
  }
  if (schItems.length > 0) {
    addGroup('Scholarship Office', schItems);
  }

  // G. ANY OTHER DEPARTMENT WITH DUES
  clearanceList.forEach((c: any) => {
    const name = c.departmentName || '';
    const alreadyGrouped = groups.some(g => g.department.toLowerCase() === name.toLowerCase() || (name.includes('Hostel') && g.department.includes('Hostel')));
    if (!alreadyGrouped && c.feeDue && Number(c.feeDue) > 0) {
      addGroup(name, [
        {
          reason: c.remarks && !c.remarks.toLowerCase().includes('pay') ? c.remarks : `${name} Outstanding Clearance Dues`,
          amount: Number(c.feeDue)
        }
      ]);
    }
  });

  const grandTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  return { groups, grandTotal };
};

function itemsPushUnique(items: DueItem[], item: DueItem) {
  if (item.amount > 0) items.push(item);
}

// Draw crisp departmental vector icons using pure jsPDF vector primitives (zero font/encoding dependencies)
export function drawDepartmentVectorIcon(doc: jsPDF, deptName: string, x: number, y: number) {
  const d = (deptName || '').toUpperCase();
  doc.saveGraphicsState();

  if (d.includes('HOSTEL')) {
    // Hostel Building / Quarters Icon
    // Roof triangle
    doc.setFillColor(153, 27, 27);
    doc.triangle(x + 2.2, y + 0.4, x + 0.4, y + 2.0, x + 4.0, y + 2.0, 'F');
    // Building structure
    doc.setFillColor(153, 27, 27);
    doc.rect(x + 0.8, y + 2.0, 2.8, 2.2, 'F');
    // Doorway cut
    doc.setFillColor(241, 245, 249);
    doc.rect(x + 1.7, y + 2.8, 1.0, 1.4, 'F');
  } else if (d.includes('LAB') || d.includes('CHEMISTRY') || d.includes('PHYSICS') || d.includes('BIOLOGY')) {
    // Laboratory Flask / Conical Beaker
    doc.setFillColor(153, 27, 27);
    // Neck
    doc.rect(x + 1.7, y + 0.6, 1.0, 1.2, 'F');
    // Rim
    doc.rect(x + 1.3, y + 0.4, 1.8, 0.4, 'F');
    // Conical flask body
    doc.triangle(x + 2.2, y + 1.6, x + 0.4, y + 4.2, x + 4.0, y + 4.2, 'F');
    // Fluid level highlight
    doc.setFillColor(255, 255, 255);
    doc.circle(x + 2.2, y + 3.4, 0.45, 'F');
  } else if (d.includes('LIBRARY')) {
    // Open Book Icon
    doc.setFillColor(153, 27, 27);
    // Left Page
    doc.roundedRect(x + 0.4, y + 0.8, 1.6, 3.2, 0.3, 0.3, 'F');
    // Right Page
    doc.roundedRect(x + 2.4, y + 0.8, 1.6, 3.2, 0.3, 0.3, 'F');
    // Spine
    doc.setFillColor(241, 245, 249);
    doc.rect(x + 2.0, y + 0.7, 0.4, 3.4, 'F');
  } else if (d.includes('IT INFRA') || d.includes('COMPUTER') || d.includes('LAPTOP') || d.includes('NETWORK')) {
    // Computer / Monitor Display Icon
    doc.setFillColor(153, 27, 27);
    // Screen bezel
    doc.roundedRect(x + 0.4, y + 0.6, 3.6, 2.6, 0.3, 0.3, 'F');
    // Screen inner display
    doc.setFillColor(241, 245, 249);
    doc.rect(x + 0.8, y + 0.9, 2.8, 1.8, 'F');
    // Monitor stand
    doc.setFillColor(153, 27, 27);
    doc.rect(x + 1.9, y + 3.2, 0.6, 0.7, 'F');
    doc.rect(x + 1.2, y + 3.9, 2.0, 0.4, 'F');
  } else if (d.includes('SCHOLARSHIP') || d.includes('ACADEMIC')) {
    // Graduation Cap / Mortarboard
    doc.setFillColor(153, 27, 27);
    // Diamond top
    doc.triangle(x + 2.2, y + 0.6, x + 0.4, y + 1.8, x + 4.0, y + 1.8, 'F');
    doc.triangle(x + 2.2, y + 2.6, x + 0.4, y + 1.8, x + 4.0, y + 1.8, 'F');
    // Skullcap
    doc.rect(x + 1.2, y + 2.0, 2.0, 1.2, 'F');
    // Golden Tassel
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.3);
    doc.line(x + 3.6, y + 1.8, x + 3.6, y + 3.6);
    doc.setFillColor(217, 119, 6);
    doc.circle(x + 3.6, y + 3.8, 0.25, 'F');
  } else if (d.includes('DSW') || d.includes('WELFARE') || d.includes('SECURITY')) {
    // Student Welfare / Protection Shield
    doc.setFillColor(153, 27, 27);
    doc.rect(x + 0.7, y + 0.6, 3.0, 1.8, 'F');
    doc.triangle(x + 2.2, y + 4.2, x + 0.7, y + 2.4, x + 3.7, y + 2.4, 'F');
    // Star emblem inside
    doc.setFillColor(255, 255, 255);
    doc.circle(x + 2.2, y + 1.8, 0.65, 'F');
  } else if (d.includes('SPORTS') || d.includes('PHYSICAL')) {
    // Sports Trophy / Emblem
    doc.setFillColor(153, 27, 27);
    doc.circle(x + 2.2, y + 1.8, 1.4, 'F');
    doc.rect(x + 1.8, y + 3.2, 0.8, 0.8, 'F');
    doc.rect(x + 1.2, y + 4.0, 2.0, 0.4, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(x + 2.2, y + 1.8, 0.7, 'F');
  } else {
    // Official University Section Badge
    doc.setFillColor(153, 27, 27);
    doc.roundedRect(x + 0.6, y + 0.6, 3.2, 3.4, 0.4, 0.4, 'F');
    doc.setFillColor(255, 255, 255);
    doc.circle(x + 2.2, y + 2.3, 0.8, 'F');
  }

  doc.restoreGraphicsState();
}

// Generate Crisp Vector PDF with Official RGUKT Certificate Header
export const generateDuesPdfBlob = async (
  _htmlTemplate: string,
  studentData: any,
  duesInput: any,
  totalDueInput?: number
): Promise<Blob> => {
  // Normalize groups
  let groups: DepartmentDuesGroup[] = [];
  if (Array.isArray(duesInput)) {
    if (duesInput.length > 0 && 'items' in duesInput[0]) {
      groups = duesInput as DepartmentDuesGroup[];
    } else {
      // Group flat rows by department
      const groupMap: Record<string, DueItem[]> = {};
      duesInput.forEach((item: any) => {
        const dept = item.department || 'Other';
        if (!groupMap[dept]) groupMap[dept] = [];
        groupMap[dept].push({
          reason: item.reason || 'Dues',
          amount: Number(item.amount) || 0
        });
      });
      groups = Object.keys(groupMap).map(dept => ({
        department: dept,
        items: groupMap[dept],
        subtotal: groupMap[dept].reduce((sum, i) => sum + i.amount, 0)
      }));
    }
  }

  const calculatedTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  const grandTotal = totalDueInput && totalDueInput > 0 ? totalDueInput : calculatedTotal;

  // Initialize jsPDF A4 document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // 1. Fetch RGUKT Logo
  const logoBase64 = await getLogoBase64();

  // Draw Header on first page
  const drawHeaderAndMeta = () => {
    // Top Logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 15, 13, 20, 20);
      } catch (e) {
        console.warn('Could not render logo in PDF:', e);
      }
    }

    // University Header Text
    const headerCenterX = 112;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(176, 58, 46); // #b03a2e official RGUKT maroon
    doc.text('RAJIV GANDHI UNIVERSITY OF KNOWLEDGE TECHNOLOGIES', headerCenterX, 16.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('(Constituted under the Act 18 of 2008, Govt. of Andhra Pradesh)', headerCenterX, 21, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('IIIT RK VALLEY CAMPUS, RGUKT-A.P.', headerCenterX, 25.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('RK Valley (Idupulapaya), Vempalli (M), Y.S.R. Kadapa Dist., Andhra Pradesh - 516330', headerCenterX, 29.5, { align: 'center' });

    // Double horizontal rules (Maroon and Amber)
    doc.setDrawColor(176, 58, 46);
    doc.setLineWidth(0.7);
    doc.line(14, 35, 196, 35);

    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.25);
    doc.line(14, 36.3, 196, 36.3);

    // Official Title Banner
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, 40, 182, 8, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(153, 27, 27);
    doc.text('OFFICIAL STATEMENT OF OUTSTANDING DUES & PENALTIES', 105, 45.5, { align: 'center' });

    // Student & Clearance Metadata Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, 50.5, 182, 18, 1.5, 1.5, 'FD');

    const curDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Left Details
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Student Name:', 18, 55);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(studentData?.name || 'N/A', 41, 55);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Student ID:', 18, 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(studentData?.studentId || 'N/A', 41, 60);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Program / Branch:', 18, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${studentData?.program || 'PUC'} ${studentData?.department ? `(${studentData.department})` : ''}`, 45, 65);

    // Right Details
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Statement Date:', 114, 55);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(curDate, 140, 55);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Reference No:', 114, 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`RGUKT/CLR/${studentData?.studentId || 'GEN'}/${new Date().getFullYear()}`, 140, 60);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Clearance Status:', 114, 65);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text('ACTION REQUIRED (Pending FO)', 140, 65);
  };

  drawHeaderAndMeta();

  // 2. Prepare Vector Table Rows divided by Department (4 Columns)
  const tableRows: any[] = [];
  let itemCounter = 1;

  if (groups.length === 0) {
    tableRows.push([
      { content: '-', styles: { halign: 'center', textColor: [100, 116, 139] } },
      { content: 'All Departments', styles: { textColor: [100, 116, 139] } },
      { content: 'No outstanding dues or penalties recorded', styles: { textColor: [22, 101, 52], fontStyle: 'italic' } },
      { content: 'Rs. 0.00', styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] } }
    ]);
  } else {
    groups.forEach((g) => {
      // Department Header Row (Spanning Sl, Department, and Reason: 12 + 46 + 84 = 142mm)
      tableRows.push([
        {
          content: `DEPARTMENT: ${g.department.toUpperCase()}`,
          colSpan: 3,
          _dept: g.department,
          _isDeptHeader: true,
          styles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 2.8, bottom: 2.8, left: 3.5, right: 2.5 }
          }
        },
        {
          content: `Subtotal: Rs. ${Number(g.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          styles: {
            fillColor: [241, 245, 249],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            halign: 'right',
            fontSize: 8.5,
            cellPadding: { top: 2.8, bottom: 2.8, left: 2, right: 2.5 }
          }
        }
      ]);

      // Each individual penalty/due item under this department
      g.items.forEach((item) => {
        tableRows.push([
          {
            content: String(itemCounter++),
            styles: { halign: 'center', textColor: [100, 116, 139], fontSize: 8 }
          },
          {
            content: g.department,
            styles: { textColor: [51, 65, 85], fontSize: 8 }
          },
          {
            content: item.reason,
            styles: { textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' }
          },
          {
            content: `Rs. ${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            styles: { textColor: [185, 28, 28], halign: 'right', fontSize: 8, fontStyle: 'bold' }
          }
        ]);
      });
    });
  }

  // 3. Render Table using autoTable with 4 columns: 12 + 46 + 84 + 40 = 182mm
  autoTable(doc, {
    startY: 71,
    margin: { left: 14, right: 14, bottom: 44 },
    head: [['#', 'Department / Section', 'Item Description / Penalty Particulars', 'Amount (Rs.)']],
    body: tableRows,
    foot: [
      [
        {
          content: 'TOTAL OUTSTANDING DUES TO PAY (Rs.):',
          colSpan: 3,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fontSize: 9.5,
            textColor: [153, 27, 27],
            fillColor: [254, 242, 242],
            cellPadding: 3
          }
        },
        {
          content: `Rs. ${Number(grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fontSize: 10,
            textColor: [185, 28, 28],
            fillColor: [254, 242, 242],
            cellPadding: 3
          }
        }
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.5
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 46 },
      2: { cellWidth: 84 },
      3: { cellWidth: 40, halign: 'right' }
    },
    didDrawCell: (data) => {
      const raw = data.row.raw as any;
      if (data.section === 'body' && data.column.index === 0 && Array.isArray(raw) && (raw[0] as any)?._isDeptHeader) {
        // Sleek RGUKT maroon left accent bar on department header
        doc.setFillColor(153, 27, 27);
        doc.rect(data.cell.x, data.cell.y, 1.2, data.cell.height, 'F');
      }
    }
  });

  // 4. In Words & Instructions & Digital Signatures
  let currentY = (doc as any).lastAutoTable?.finalY || 160;

  // Add new page if table ran near bottom
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  // Amount in words box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.roundedRect(14, currentY + 3, 182, 7.5, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Amount in words: ', 17, currentY + 7.8);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(15, 23, 42);
  doc.text(numberToIndianWords(grandTotal), 43, currentY + 7.8);

  // Student instructions
  currentY += 13.5;
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(14, currentY, 182, 17, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  doc.text('Important Instructions for Student Clearance:', 17, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(120, 53, 15);
  doc.text('1. Settle the above outstanding dues at the Finance Office (FO) counter or via the official payment portal.', 17, currentY + 8.5);
  doc.text('2. Upload the stamped bank challan / payment transaction receipt on the Student Clearance Portal dashboard.', 17, currentY + 12);
  doc.text('3. Once the Finance Officer validates the payment, your final official "No Due Certificate" will be unlocked.', 17, currentY + 15.5);

  // Digital Signatures
  currentY += 22;
  doc.setFont('times', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('Approved Digitally', 42, currentY + 5, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(22, currentY + 7, 62, currentY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Department In-charges / Wardens', 42, currentY + 10.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RGUKT IIIT RK Valley', 42, currentY + 14, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);
  doc.text('Approved Digitally', 165, currentY + 5, { align: 'center' });
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(145, currentY + 7, 185, currentY + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Finance Officer / Admin Officer', 165, currentY + 10.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RGUKT IIIT RK Valley', 165, currentY + 14, { align: 'center' });

  // 5. Draw Certificate Outer Borders, Watermark & Footers on ALL pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Double Certificate Outer Border
    doc.setDrawColor(153, 27, 27);
    doc.setLineWidth(0.7);
    doc.rect(8, 8, 194, 281);

    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.25);
    doc.rect(10, 10, 190, 277);

    // Corner security brackets
    const drawBracket = (bx: number, by: number, dx: number, dy: number) => {
      doc.setDrawColor(217, 119, 6);
      doc.setLineWidth(0.4);
      doc.line(bx, by, bx + dx * 4, by);
      doc.line(bx, by, bx, by + dy * 4);
    };
    drawBracket(12, 12, 1, 1);
    drawBracket(198, 12, -1, 1);
    drawBracket(12, 285, 1, -1);
    drawBracket(198, 285, -1, -1);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Official Document - RGUKT Clearance Automation Hub - Valid without physical seal if verified online', 105, 284, { align: 'center' });
    doc.text(`Page ${i} of ${totalPages}`, 190, 284, { align: 'right' });
  }

  return doc.output('blob');
};

// Direct browser download
export const downloadPdfDirectly = (pdfBlob: Blob, fileName: string) => {
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Upload to Google Drive (when authorized)
export const uploadToGoogleDrive = async (pdfBlob: Blob, fileName: string): Promise<string> => {
  const token = localStorage.getItem('gdrive_token');
  if (!token) {
    throw new Error('Google Drive access token not found. Please log out and log in again with Google to grant Drive access.');
  }

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', pdfBlob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Google Drive upload failed: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const fileId = data.id;

  // Make public read
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone'
    })
  }).catch((pErr) => console.warn('Could not set public permission:', pErr));

  return fileId;
};

export const getDriveDownloadLink = (fileId: string) => `https://drive.google.com/uc?export=download&id=${fileId}`;
export const getDrivePreviewLink = (fileId: string) => `https://drive.google.com/file/d/${fileId}/view`;

