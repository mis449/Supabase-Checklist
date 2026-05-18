import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import { IndianRupee, Save, ArrowLeft, Loader2, Plus, Trash2, Calendar, User, FileText, Download } from "lucide-react";
import supabase from "../../SupabaseClient";
import { useMagicToast } from "../../context/MagicToastContext";

const getDaysInMonth = (monthStr) => {
    const [year, month] = monthStr.split("-").map(Number);
    return new Date(year, month, 0).getDate();
};

const getSundaysInMonth = (monthStr) => {
    const [year, month] = monthStr.split("-").map(Number);
    const days = new Date(year, month, 0).getDate();
    let sundays = 0;
    for (let i = 1; i <= days; i++) {
        if (new Date(year, month - 1, i).getDay() === 0) {
            sundays++;
        }
    }
    return sundays;
};

const formatMonthDisplay = (monthStr) => {
    if (!monthStr) return "";
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthName = date.toLocaleString('default', { month: 'long' }).toLowerCase();
    return `${year}-${monthName}`;
};

export default function SalaryManagement() {
    const navigate = useNavigate();
    const { showToast } = useMagicToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [employees, setEmployees] = useState([]);
    
    // Initial state with calculated days
    const [rows, setRows] = useState(() => {
        const initialMonth = new Date().toISOString().slice(0, 7);
        const total = getDaysInMonth(initialMonth);
        const sun = getSundaysInMonth(initialMonth);
        return [{
            sr_no: "1",
            employee_name: "",
            basic_salary: 0,
            extra_days: 0,
            advance: 0,
            absent: 0,
            half_day: 0,
            biometric_mismatch: 0,
            late_comers: 0,
            final_amt: 0,
            round_off: 0,
            working_days: 0,
            total_days: total,
            remarks: ""
        }];
    });
    const [submittedData, setSubmittedData] = useState([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    
    // Add Employee State
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
    const [newEmp, setNewEmp] = useState({ name: "", basic_salary: 0 });
    const [isSavingEmp, setIsSavingEmp] = useState(false);

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        fetchSubmittedData();
        // Update all rows with new month defaults
        const totalDays = getDaysInMonth(salaryMonth);

        setRows(prevRows => prevRows.map(row => {
            const updatedRow = { 
                ...row, 
                total_days: totalDays
            };
            const finalAmt = calculateRowFinalAmount(updatedRow);
            return {
                ...updatedRow,
                final_amt: finalAmt,
                round_off: finalAmt
            };
        }));
    }, [salaryMonth]);

    const fetchSubmittedData = async () => {
        setIsLoadingData(true);
        try {
            const { data, error } = await supabase
                .from("salaries")
                .select("*")
                .eq("salary_month", salaryMonth)
                .order("created_at", { ascending: false });
            if (error) throw error;
            setSubmittedData(data || []);
        } catch (err) {
            console.error("Error fetching submitted data:", err);
        } finally {
            setIsLoadingData(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from("employee_master")
                .select("id, name, basic_salary")
                .order("name");
            if (data) {
                setEmployees(data);
            }
        } catch (err) {
            console.error("Error fetching employees:", err);
        }
    };

    const calculateRowFinalAmount = (row) => {
        const basic = parseFloat(row.basic_salary) || 0;
        const totalDays = parseFloat(row.total_days) || 0;
        const workingDays = parseFloat(row.working_days) || 0;
        const bioMismatch = parseFloat(row.biometric_mismatch) || 0;
        const lateComers = parseFloat(row.late_comers) || 0;
        
        if (totalDays <= 0) return 0;
        
        const perDaySalary = basic / totalDays;
        const salaryBasedOnWorkingDays = perDaySalary * workingDays;
        
        const total = salaryBasedOnWorkingDays - bioMismatch - lateComers;
        return Math.round(total);
    };

    const handleEmployeeChange = (index, employeeName) => {
        const newRows = [...rows];
        newRows[index].employee_name = employeeName;
        
        // Find the employee's basic salary from our master list
        const selectedEmployee = employees.find(emp => emp.name === employeeName);
        if (selectedEmployee) {
            newRows[index].basic_salary = selectedEmployee.basic_salary;
        } else {
            newRows[index].basic_salary = 0;
        }

        const finalAmt = calculateRowFinalAmount(newRows[index]);
        newRows[index].final_amt = finalAmt;
        newRows[index].round_off = finalAmt;
        setRows(newRows);
    };

    const handleInputChange = (index, field, value) => {
        const newRows = [...rows];
        
        // Convert to number if it's a numeric field
        const numericFields = ["basic_salary", "extra_days", "advance", "absent", "half_day", "biometric_mismatch", "late_comers", "final_amt", "round_off", "working_days", "total_days"];
        if (numericFields.includes(field)) {
            newRows[index][field] = value === "" ? 0 : parseFloat(value);
        } else {
            newRows[index][field] = value;
        }

        // Auto-calculate final amount if any contributing field changes
        const calculationFields = ["basic_salary", "working_days", "biometric_mismatch", "late_comers", "total_days"];
        if (calculationFields.includes(field)) {
            const finalAmt = calculateRowFinalAmount(newRows[index]);
            newRows[index].final_amt = finalAmt;
            newRows[index].round_off = finalAmt;
        }

        setRows(newRows);
    };

    const addRow = () => {
        const totalDays = getDaysInMonth(salaryMonth);
        const sundays = getSundaysInMonth(salaryMonth);
        const defaultWorkingDays = totalDays - sundays;

        setRows([...rows, {
            sr_no: (rows.length + 1).toString(),
            employee_name: "",
            basic_salary: 0,
            extra_days: 0,
            advance: 0,
            absent: 0,
            half_day: 0,
            biometric_mismatch: 0,
            late_comers: 0,
            final_amt: 0,
            round_off: 0,
            working_days: 0,
            total_days: totalDays,
            remarks: ""
        }]);
    };

    const removeRow = (index) => {
        if (rows.length > 1) {
            const newRows = rows.filter((_, i) => i !== index).map((row, i) => ({ ...row, sr_no: (i + 1).toString() }));
            setRows(newRows);
        } else {
            // Just reset the first row
            const totalDays = getDaysInMonth(salaryMonth);
            const sundays = getSundaysInMonth(salaryMonth);
            const defaultWorkingDays = totalDays - sundays;
            
            setRows([{
                sr_no: "1",
                employee_name: "",
                basic_salary: 0,
                extra_days: 0,
                advance: 0,
                absent: 0,
                half_day: 0,
                biometric_mismatch: 0,
                late_comers: 0,
                final_amt: 0,
                round_off: 0,
                working_days: 0,
                total_days: totalDays,
                remarks: ""
            }]);
        }
    };

    const handleSubmit = async () => {
        // Validate
        const invalidRows = rows.filter(r => !r.employee_name);
        if (invalidRows.length > 0) {
            showToast("Please select employee name for all rows", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const dataToInsert = rows.map(row => ({
                ...row,
                salary_month: salaryMonth
            }));

            const { error } = await supabase.from("salaries").insert(dataToInsert);
            if (error) throw error;

            showToast("Salary data submitted successfully!", "success");
            
            // Refresh submitted data
            fetchSubmittedData();

            // Clear entry rows
            const totalDays = getDaysInMonth(salaryMonth);
            const sundays = getSundaysInMonth(salaryMonth);
            const defaultWorkingDays = totalDays - sundays;

            setRows([{
                sr_no: "1",
                employee_name: "",
                basic_salary: 0,
                extra_days: 0,
                advance: 0,
                absent: 0,
                half_day: 0,
                biometric_mismatch: 0,
                late_comers: 0,
                final_amt: 0,
                round_off: 0,
                working_days: 0,
                total_days: totalDays,
                remarks: ""
            }]);
        } catch (err) {
            console.error("Error saving salary:", err);
            showToast("Failed to save salary: " + err.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddEmployee = async (e) => {
        e.preventDefault();
        if (!newEmp.name || newEmp.basic_salary <= 0) {
            showToast("Please enter valid name and salary", "error");
            return;
        }

        setIsSavingEmp(true);
        try {
            const { error } = await supabase
                .from("employee_master")
                .insert([newEmp]);
            
            if (error) throw error;

            showToast(newEmp.id ? "Employee updated successfully!" : "Employee added successfully!", "success");
            setIsEmployeeModalOpen(false);
            setNewEmp({ name: "", basic_salary: 0 });
            fetchEmployees(); // Refresh the list
        } catch (err) {
            console.error("Error saving employee:", err);
            showToast("Failed to save employee: " + err.message, "error");
        } finally {
            setIsSavingEmp(false);
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm("Are you sure you want to delete this employee? This will not affect existing salary records.")) return;
        
        try {
            const { error } = await supabase.from("employee_master").delete().eq("id", id);
            if (error) throw error;
            showToast("Employee deleted!", "success");
            fetchEmployees();
        } catch (err) {
            showToast("Failed to delete: " + err.message, "error");
        }
    };

    const downloadSalarySlip = (item) => {
        const slipWindow = window.open("", "_blank");
        const monthName = formatMonthDisplay(item.salary_month);
        
        const perDaySalary = item.total_days > 0 ? (item.basic_salary / item.total_days) : 0;
        const salaryBasedOnWorkingDays = perDaySalary * (item.working_days || 0);

        slipWindow.document.write(`
            <html>
                <head>
                    <title>Salary Slip - ${item.employee_name}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                        .slip-container { border: 2px solid #eee; padding: 30px; border-radius: 20px; max-width: 800px; margin: auto; }
                        .header { text-align: center; border-bottom: 2px solid #a855f7; padding-bottom: 20px; margin-bottom: 30px; }
                        .company-name { font-size: 24px; font-weight: 900; color: #9333ea; text-transform: uppercase; margin: 0; }
                        .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                        .slip-title { font-size: 18px; font-weight: bold; background: #f8fafc; display: inline-block; padding: 8px 20px; border-radius: 10px; margin-top: 15px; }
                        .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                        .detail-item { font-size: 14px; }
                        .label { color: #64748b; font-weight: bold; margin-bottom: 4px; }
                        .value { font-weight: 800; color: #1e293b; font-size: 16px; }
                        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        .table th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
                        .table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; }
                        .footer { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
                        .signature { border-top: 1px solid #ddd; width: 200px; text-align: center; padding-top: 10px; font-size: 12px; color: #666; }
                        .total-section { background: #9333ea; color: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center; }
                        .total-label { font-size: 16px; font-weight: bold; }
                        .total-value { font-size: 24px; font-weight: 900; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="slip-container">
                        <div class="header">
                            <h1 class="company-name">PAREKH CHECKLIST & DELEGATION</h1>
                            <p class="subtitle">Employee Monthly Salary Statement</p>
                            <div class="slip-title">Salary Slip for ${monthName.toUpperCase()}</div>
                        </div>

                        <div class="details-grid">
                            <div class="detail-item">
                                <div class="label">Employee Name</div>
                                <div class="value">${item.employee_name}</div>
                            </div>
                            <div class="detail-item">
                                <div class="label">Employee ID</div>
                                <div class="value">EMP-${item.id}</div>
                            </div>
                        </div>

                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Days / Details</th>
                                    <th>Amount / Calculation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Basic Salary</td>
                                    <td>${item.total_days} Days (Month)</td>
                                    <td>₹${item.basic_salary}</td>
                                </tr>
                                <tr>
                                    <td>Per Day Salary</td>
                                    <td>Basic / Total Days</td>
                                    <td>₹${perDaySalary.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td>Worked Days</td>
                                    <td>${item.working_days} Days</td>
                                    <td>-</td>
                                </tr>
                                <tr>
                                    <td>Salary Based on Working Days</td>
                                    <td>Per Day × Working Days</td>
                                    <td>₹${salaryBasedOnWorkingDays.toFixed(2)}</td>
                                </tr>
                                ${item.biometric_mismatch > 0 ? `<tr><td style="color: #dc2626">Bio Mismatch Deduction</td><td>-</td><td>(-) ₹${item.biometric_mismatch}</td></tr>` : ""}
                                ${item.late_comers > 0 ? `<tr><td style="color: #dc2626">Late Comers Deduction</td><td>-</td><td>(-) ₹${item.late_comers}</td></tr>` : ""}
                            </tbody>
                        </table>

                        <div class="total-section">
                            <div class="total-label">Net Payable Salary</div>
                            <div class="total-value">₹${item.round_off}</div>
                        </div>

                        <div class="footer">
                            <div class="signature">Employee Signature</div>
                            <div class="signature">Authorized Signatory</div>
                        </div>
                        
                        <p style="text-align: center; font-size: 10px; color: #aaa; margin-top: 30px;">
                            This is a computer-generated salary slip and does not require a physical signature.
                        </p>
                    </div>
                    <script>
                        window.onload = function() {
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        slipWindow.document.close();
    };

    const downloadSalarySlipAsDoc = (item) => {
        const monthName = formatMonthDisplay(item.salary_month);
        const perDaySalary = item.total_days > 0 ? (item.basic_salary / item.total_days) : 0;
        const salaryBasedOnWorkingDays = perDaySalary * (item.working_days || 0);

        const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Salary Slip</title>
            <style>
                body { font-family: Arial, sans-serif; }
                .slip-container { width: 100%; border: 1px solid #ccc; padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .details { margin-bottom: 20px; }
                .table { width: 100%; border-collapse: collapse; }
                .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .total { margin-top: 20px; font-weight: bold; background: #eee; padding: 10px; }
            </style>
            </head>
            <body>
                <div class="slip-container">
                    <div class="header">
                        <h1>PAREKH CHECKLIST & DELEGATION</h1>
                        <h3>Salary Slip for ${monthName.toUpperCase()}</h3>
                    </div>
                    <div class="details">
                        <p><strong>Employee:</strong> ${item.employee_name}</p>
                        <p><strong>Month:</strong> ${monthName}</p>
                    </div>
                    <table class="table">
                        <thead>
                            <tr><th>Description</th><th>Details</th><th>Value</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Basic Salary</td><td>${item.total_days} Days</td><td>₹${item.basic_salary}</td></tr>
                            <tr><td>Per Day Salary</td><td>Basic / Total Days</td><td>₹${perDaySalary.toFixed(2)}</td></tr>
                            <tr><td>Working Days</td><td>${item.working_days} Days</td><td>-</td></tr>
                            <tr><td>Salary Based on Working Days</td><td>Per Day × Working Days</td><td>₹${salaryBasedOnWorkingDays.toFixed(2)}</td></tr>
                            <tr><td>Bio Mismatch Deduction</td><td>-</td><td>₹${item.biometric_mismatch}</td></tr>
                            <tr><td>Late Comers Deduction</td><td>-</td><td>₹${item.late_comers}</td></tr>
                        </tbody>
                    </table>
                    <div class="total">
                        <p>NET PAYABLE: ₹${item.round_off}</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Salary_Slip_${item.employee_name}_${item.salary_month}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadSalarySlipAsPDF = (item) => {
        const monthName = formatMonthDisplay(item.salary_month);
        const perDaySalary = item.total_days > 0 ? (item.basic_salary / item.total_days) : 0;
        const salaryBasedOnWorkingDays = perDaySalary * (item.working_days || 0);

        const element = document.createElement("div");
        element.style.padding = "40px";
        element.style.fontFamily = "Arial, sans-serif";
        element.innerHTML = `
            <div style="border: 2px solid #eee; padding: 30px; border-radius: 20px; max-width: 800px; margin: auto;">
                <div style="text-align: center; border-bottom: 2px solid #a855f7; padding-bottom: 20px; margin-bottom: 30px;">
                    <h1 style="font-size: 24px; font-weight: 900; color: #9333ea; text-transform: uppercase; margin: 0;">PAREKH CHECKLIST & DELEGATION</h1>
                    <p style="font-size: 14px; color: #666; margin-top: 5px;">Employee Monthly Salary Statement</p>
                    <div style="font-size: 18px; font-weight: bold; background: #f8fafc; display: inline-block; padding: 8px 20px; border-radius: 10px; margin-top: 15px;">Salary Slip for ${monthName.toUpperCase()}</div>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
                    <div>
                        <div style="color: #64748b; font-weight: bold; font-size: 12px;">Employee Name</div>
                        <div style="font-weight: 800; color: #1e293b; font-size: 16px;">${item.employee_name}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: #64748b; font-weight: bold; font-size: 12px;">Employee ID</div>
                        <div style="font-weight: 800; color: #1e293b; font-size: 16px;">EMP-${item.id}</div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Description</th>
                            <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b;">Details</th>
                            <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #64748b;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Basic Salary</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">${item.total_days} Days</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right;">₹${item.basic_salary}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Per Day Salary</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">Basic / Total Days</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right;">₹${perDaySalary.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Worked Days</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">${item.working_days} Days</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right;">-</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600;">Salary Based on Working Days</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">Per Day × Working Days</td>
                            <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-weight: 600; text-align: right;">₹${salaryBasedOnWorkingDays.toFixed(2)}</td>
                        </tr>
                        ${item.biometric_mismatch > 0 ? `<tr><td style="padding: 12px; border-bottom: 1px solid #f1f5f9; color: #dc2626; font-weight: 600;">Bio Mismatch Deduction</td><td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">-</td><td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #dc2626;">(-) ₹${item.biometric_mismatch}</td></tr>` : ""}
                        ${item.late_comers > 0 ? `<tr><td style="padding: 12px; border-bottom: 1px solid #f1f5f9; color: #dc2626; font-weight: 600;">Late Comers Deduction</td><td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">-</td><td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #dc2626;">(-) ₹${item.late_comers}</td></tr>` : ""}
                    </tbody>
                </table>

                <div style="background: #9333ea; color: white; padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 16px; font-weight: bold;">Net Payable Salary</div>
                    <div style="font-size: 24px; font-weight: 900;">₹${item.round_off}</div>
                </div>

                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <div style="border-top: 1px solid #ddd; width: 150px; text-align: center; padding-top: 10px; font-size: 10px; color: #666;">Employee Signature</div>
                    <div style="border-top: 1px solid #ddd; width: 150px; text-align: center; padding-top: 10px; font-size: 10px; color: #666;">Authorized Signatory</div>
                </div>
            </div>
        `;

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => {
            const opt = {
                margin: 0.5,
                filename: `Salary_Slip_${item.employee_name}_${item.salary_month}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            window.html2pdf().set(opt).from(element).save();
        };
        document.head.appendChild(script);
    };

    const deleteRecord = async (id) => {
        if (!window.confirm("Are you sure you want to delete this record?")) return;
        
        try {
            const { error } = await supabase.from("salaries").delete().eq("id", id);
            if (error) throw error;
            showToast("Record deleted", "success");
            fetchSubmittedData();
        } catch (err) {
            showToast("Delete failed: " + err.message, "error");
        }
    };

    return (
        <AdminLayout>
            <div className="max-w-[1400px] mx-auto p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-200">
                                    <IndianRupee size={24} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Salary Management</h1>
                                    <p className="text-sm text-gray-400 font-medium">Record and manage monthly employee salaries</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => {
                                    setNewEmp({ name: "", basic_salary: 0 });
                                    setIsEmployeeModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
                            >
                                <Plus size={18} />
                                Manage Employees
                            </button>
                        </div>
                    
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl">
                            <Calendar size={18} className="text-purple-500" />
                            <input 
                                type="month" 
                                value={salaryMonth}
                                onChange={(e) => setSalaryMonth(e.target.value)}
                                className="bg-transparent font-bold outline-none text-sm"
                            />
                        </div>
                        <button 
                            onClick={() => navigate(-1)} 
                            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Vertical Form Entry Section */}
                <div className="space-y-6 mb-8">
                    {rows.map((row, index) => (
                        <div key={index} className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-purple-100/20 overflow-hidden transition-all hover:shadow-purple-200/30">
                            {/* Card Header */}
                            <div className="bg-purple-600 px-6 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-sm">
                                        {row.sr_no}
                                    </span>
                                    <h3 className="text-white font-bold tracking-tight">Entry Details</h3>
                                </div>
                                {rows.length > 1 && (
                                    <button 
                                        onClick={() => removeRow(index)}
                                        className="p-1.5 bg-white/10 text-white hover:bg-white/20 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Card Body - Grid Layout */}
                            <div className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {/* Employee Name */}
                                    <div className="lg:col-span-2 xl:col-span-1">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Employee Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <select 
                                                value={row.employee_name}
                                                onChange={(e) => handleEmployeeChange(index, e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-purple-500 outline-none transition-all appearance-none"
                                            >
                                                <option value="">Select Employee</option>
                                                {employees.map(emp => (
                                                    <option key={emp.name} value={emp.name}>{emp.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Basic Salary */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Basic Salary</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                value={row.basic_salary || ""} 
                                                onChange={(e) => handleInputChange(index, "basic_salary", e.target.value)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-black text-purple-600 focus:bg-white focus:border-purple-500 outline-none transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                        {row.basic_salary > 0 && row.total_days > 0 && (
                                            <div className="text-[10px] text-purple-600 font-bold mt-1.5 ml-1">
                                                Per Day: ₹{(row.basic_salary / row.total_days).toFixed(2)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Total Days */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Days</label>
                                        <input 
                                            type="number" 
                                            value={row.total_days} 
                                            onChange={(e) => handleInputChange(index, "total_days", e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-purple-500 outline-none transition-all"
                                            placeholder="0"
                                        />
                                    </div>

                                    {/* Working Days */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Working Days</label>
                                        <input 
                                            type="number" 
                                            value={row.working_days || ""} 
                                            onChange={(e) => handleInputChange(index, "working_days", e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-purple-500 outline-none transition-all"
                                            placeholder="0"
                                        />
                                        {row.basic_salary > 0 && row.total_days > 0 && row.working_days > 0 && (
                                            <div className="text-[10px] text-purple-600 font-bold mt-1.5 ml-1">
                                                Based on Work: ₹{((row.basic_salary / row.total_days) * row.working_days).toFixed(2)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Bio Mismatch Deduction */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Bio Mismatch Deduction</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                value={row.biometric_mismatch || ""} 
                                                onChange={(e) => handleInputChange(index, "biometric_mismatch", e.target.value)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-red-500 focus:bg-white focus:border-red-500 outline-none transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Late Comers Deduction */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Late Comers Deduction</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                value={row.late_comers || ""} 
                                                onChange={(e) => handleInputChange(index, "late_comers", e.target.value)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-red-500 focus:bg-white focus:border-red-500 outline-none transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Final Amount */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Final Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                value={row.final_amt || ""} 
                                                onChange={(e) => handleInputChange(index, "final_amt", e.target.value)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-purple-50 border border-purple-200 rounded-2xl text-sm font-black text-purple-700 focus:bg-white focus:border-purple-500 outline-none transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Round Off */}
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Round Off</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                value={row.round_off || ""} 
                                                onChange={(e) => handleInputChange(index, "round_off", e.target.value)}
                                                className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-purple-500 outline-none transition-all"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Remarks */}
                                    <div className="lg:col-span-2 xl:col-span-1">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Remarks</label>
                                        <input 
                                            type="text" 
                                            value={row.remarks || ""} 
                                            onChange={(e) => handleInputChange(index, "remarks", e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-2xl text-sm font-medium text-gray-600 focus:bg-white focus:border-purple-500 outline-none transition-all"
                                            placeholder="Any notes..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <button 
                        onClick={addRow}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 font-bold rounded-2xl border-2 border-purple-100 hover:border-purple-300 hover:bg-purple-50 transition-all shadow-sm"
                    >
                        <Plus size={20} />
                        Add New Row
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button 
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-xl shadow-purple-200 transform transition-all active:scale-95 disabled:opacity-70"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={20} className="animate-spin" /> Saving...</>
                            ) : (
                                <><Save size={20} /> Submit Salary Data</>
                            )}
                        </button>
                    </div>
                </div>

                {/* Submitted Data List */}
                <div className="mt-12">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-500 rounded-xl text-white shadow-md">
                            <Save size={18} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Submitted Records ({formatMonthDisplay(salaryMonth)})</h2>
                            <p className="text-xs text-gray-400 font-medium">History of salary data for this month</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-green-100/20 overflow-hidden">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Sr.No.</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Employee</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Days</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Work. Days</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Basic</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Per Day</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Work Salary</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">Bio Ded.</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">Late Ded.</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Round Off</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider">Remarks</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">Slip</th>
                                        <th className="p-4 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">Delete</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingData ? (
                                        <tr>
                                            <td colSpan="13" className="p-8 text-center text-gray-400 font-medium">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                Loading submitted records...
                                            </td>
                                        </tr>
                                    ) : submittedData.length === 0 ? (
                                        <tr>
                                            <td colSpan="13" className="p-8 text-center text-gray-400 font-medium">
                                                No records found for this month.
                                            </td>
                                        </tr>
                                    ) : (
                                        submittedData.map((item, i) => {
                                            const perDay = item.total_days > 0 ? (item.basic_salary / item.total_days) : 0;
                                            const workSalary = perDay * (item.working_days || 0);
                                            return (
                                                <tr key={item.id} className="border-b border-gray-50 hover:bg-green-50/20 transition-colors">
                                                    <td className="py-2.5 px-4 text-sm font-bold text-gray-400">{item.sr_no}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-gray-700">{item.employee_name}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-gray-400">{item.total_days}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-gray-600">{item.working_days}</td>
                                                    <td className="py-2.5 px-4 text-sm font-black text-purple-600">₹{item.basic_salary}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-purple-500">₹{perDay.toFixed(2)}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-purple-700">₹{workSalary.toFixed(2)}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-red-500 text-center">₹{item.biometric_mismatch}</td>
                                                    <td className="py-2.5 px-4 text-sm font-bold text-red-500 text-center">₹{item.late_comers}</td>
                                                    <td className="py-2.5 px-4">
                                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black">
                                                            ₹{item.round_off}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs italic text-gray-500">{item.remarks}</td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button 
                                                                onClick={() => downloadSalarySlip(item)}
                                                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                                                                title="View Slip"
                                                            >
                                                                <FileText size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => downloadSalarySlipAsPDF(item)}
                                                                className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-all"
                                                                title="Download PDF"
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-center">
                                                        <button 
                                                            onClick={() => deleteRecord(item.id)}
                                                            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Delete Record"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden p-4 space-y-4 bg-gray-50/50">
                            {isLoadingData ? (
                                <div className="p-8 text-center text-gray-400 font-medium">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    Loading...
                                </div>
                            ) : submittedData.length === 0 ? (
                                <div className="p-8 text-center text-gray-400 font-medium">
                                    No records found.
                                </div>
                            ) : (
                                submittedData.map((item) => {
                                    const perDay = item.total_days > 0 ? (item.basic_salary / item.total_days) : 0;
                                    const workSalary = perDay * (item.working_days || 0);
                                    return (
                                        <div key={item.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Employee</span>
                                                    <h4 className="text-base font-black text-gray-800">{item.employee_name}</h4>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Round Off</span>
                                                    <div className="text-lg font-black text-green-600">₹{item.round_off}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-50">
                                                <div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Work. Days</span>
                                                    <span className="text-sm font-bold text-gray-700">{item.working_days} / {item.total_days}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Basic Salary</span>
                                                    <span className="text-sm font-bold text-purple-600">₹{item.basic_salary}</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 py-3 border-b border-gray-50">
                                                <div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Per Day</span>
                                                    <span className="text-sm font-bold text-purple-500">₹{perDay.toFixed(2)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Work Salary</span>
                                                    <span className="text-sm font-bold text-purple-700">₹{workSalary.toFixed(2)}</span>
                                                </div>
                                            </div>

                                            <div className="py-3 border-b border-gray-50">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Deductions</span>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold">Bio Ded: ₹{item.biometric_mismatch}</span>
                                                    <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold">Late Ded: ₹{item.late_comers}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex gap-2">
                                                    <button onClick={() => downloadSalarySlip(item)} className="p-2.5 bg-purple-50 text-purple-600 rounded-xl flex items-center gap-2 text-xs font-bold transition-all active:scale-95">
                                                        <FileText size={14} /> View
                                                    </button>
                                                    <button onClick={() => downloadSalarySlipAsPDF(item)} className="p-2.5 bg-green-50 text-green-600 rounded-xl flex items-center gap-2 text-xs font-bold transition-all active:scale-95">
                                                        <Download size={14} /> PDF
                                                    </button>
                                                </div>
                                                <button onClick={() => deleteRecord(item.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl transition-all active:scale-95">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type=number] {
                    -moz-appearance: textfield;
                }
            ` }} />
            {/* Add/Manage Employee Modal */}
            {isEmployeeModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200 my-8">
                        <div className="bg-purple-600 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-white font-bold tracking-tight">
                                {newEmp.id ? "Edit Employee" : "Add New Employee"}
                            </h3>
                            <button onClick={() => {
                                setIsEmployeeModalOpen(false);
                                setNewEmp({ name: "", basic_salary: 0 });
                            }} className="text-white/80 hover:text-white transition-colors">
                                <Plus className="rotate-45" size={24} />
                            </button>
                        </div>
                        
                        <div className="p-5 space-y-5">
                            {/* Form Section */}
                            <form onSubmit={handleAddEmployee} className="bg-gray-50 p-4 rounded-3xl space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text" 
                                                required
                                                value={newEmp.name}
                                                onChange={(e) => setNewEmp({...newEmp, name: e.target.value})}
                                                className="w-full pl-10 pr-4 py-2 bg-white border border-transparent rounded-2xl text-sm font-bold text-gray-700 focus:border-purple-500 outline-none transition-all shadow-sm"
                                                placeholder="Employee name"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Basic Salary</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input 
                                                type="number" 
                                                required
                                                value={newEmp.basic_salary || ""}
                                                onChange={(e) => setNewEmp({...newEmp, basic_salary: parseFloat(e.target.value) || 0})}
                                                className="w-full pl-8 pr-4 py-2 bg-white border border-transparent rounded-2xl text-sm font-black text-purple-600 focus:border-purple-500 outline-none transition-all shadow-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button 
                                        type="submit" 
                                        disabled={isSavingEmp}
                                        className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-purple-700 disabled:bg-gray-300 transition-all shadow-lg shadow-purple-100 flex items-center justify-center gap-2"
                                    >
                                        {isSavingEmp ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                                        {newEmp.id ? "Update" : "Add Employee"}
                                    </button>
                                    {newEmp.id && (
                                        <button 
                                            type="button"
                                            onClick={() => setNewEmp({ name: "", basic_salary: 0 })}
                                            className="px-4 py-2.5 bg-gray-200 text-gray-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-300 transition-all"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </form>

                            {/* List Section */}
                            <div>
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Existing Employees ({employees.length})</h4>
                                <div className="max-h-[400px] overflow-y-auto border border-gray-100 rounded-3xl overflow-hidden scrollbar-thin scrollbar-thumb-gray-200">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10 shadow-sm">
                                            <tr>
                                                <th className="p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">Name</th>
                                                <th className="p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">Salary</th>
                                                <th className="p-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {employees.map(emp => (
                                                <tr key={emp.id} className="hover:bg-purple-50/30 transition-colors">
                                                    <td className="p-3 text-sm font-bold text-gray-700">{emp.name}</td>
                                                    <td className="p-3 text-sm font-black text-purple-600">₹{emp.basic_salary}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                                onClick={() => setNewEmp(emp)}
                                                                className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-lg transition-all"
                                                                title="Edit"
                                                            >
                                                                <Save size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteEmployee(emp.id)}
                                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
