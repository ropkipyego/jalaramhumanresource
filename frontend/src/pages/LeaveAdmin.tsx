import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, RotateCcw, Search, Filter, Calendar, User, Clock } from "lucide-react";
import type { LeaveStatus, LeaveType } from "@/types/database";

interface LeaveRequestWithDetails {
  id: string;
  employee_id: string;
  department_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  employee: {
    id: string;
    full_name: string;
    email: string;
    staff_id: string;
  };
  department: {
    id: string;
    name: string;
    code: string;
  };
  reviewer?: {
    full_name: string;
  } | null;
}

const LeaveAdmin = () => {
  const { user } = useAuth();
  const { isHead, isAdmin, isSuperAdmin, headDepartments } = useRole();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "all">("pending");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    request: LeaveRequestWithDetails | null;
    action: "approve" | "reject" | "return" | null;
  }>({ open: false, request: null, action: null });
  const [adminNotes, setAdminNotes] = useState("");

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch leave requests
  const { data: leaveRequests = [], isLoading } = useQuery({
    queryKey: ["leave-requests-admin", statusFilter, departmentFilter],
    queryFn: async () => {
      let query = supabase
        .from("leave_requests")
        .select(`
          *,
          employee:profiles!leave_requests_employee_id_fkey(id, full_name, email, staff_id),
          department:departments!leave_requests_department_id_fkey(id, name, code)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (departmentFilter !== "all") {
        query = query.eq("department_id", departmentFilter);
      }

      // For HEAD role, only show their departments
      if (isHead && !isAdmin && !isSuperAdmin) {
        query = query.in("department_id", headDepartments);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch reviewer names separately
      const reviewerIds = [...new Set(data.filter(r => r.reviewed_by).map(r => r.reviewed_by))];
      let reviewers: Record<string, string> = {};
      
      if (reviewerIds.length > 0) {
        const { data: reviewerData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reviewerIds);
        
        if (reviewerData) {
          reviewers = Object.fromEntries(reviewerData.map(r => [r.id, r.full_name]));
        }
      }

      return data.map(r => ({
        ...r,
        reviewer: r.reviewed_by ? { full_name: reviewers[r.reviewed_by] || "Unknown" } : null,
      })) as LeaveRequestWithDetails[];
    },
    enabled: isHead || isAdmin || isSuperAdmin,
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      status, 
      notes 
    }: { 
      requestId: string; 
      status: LeaveStatus; 
      notes: string;
    }) => {
      const { data: existing } = await supabase
        .from("leave_requests").select("employee_id, start_date, end_date").eq("id", requestId).single();

      const { error } = await supabase
        .from("leave_requests")
        .update({
          status,
          admin_notes: notes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      
      if (error) throw error;

      // Fire web push (in-app notification is auto-created by DB trigger)
      if (existing && (status === "approved" || status === "rejected")) {
        supabase.functions.invoke("send-push", {
          body: {
            userIds: [existing.employee_id],
            title: status === "approved" ? "Leave Approved" : "Leave Rejected",
            body: `Your leave from ${existing.start_date} to ${existing.end_date} was ${status}.`,
            url: "/my-leave",
            tag: `leave-${requestId}`,
          },
        }).catch(() => {});
      }
    },
    onSuccess: (_, variables) => {
      const actionText = variables.status === "approved" ? "approved" : 
                         variables.status === "rejected" ? "rejected" : "returned";
      toast.success(`Leave request ${actionText} successfully`);
      queryClient.invalidateQueries({ queryKey: ["leave-requests-admin"] });
      setReviewDialog({ open: false, request: null, action: null });
      setAdminNotes("");
    },
    onError: (error) => {
      toast.error("Failed to update leave request");
      console.error(error);
    },
  });

  const handleReview = (request: LeaveRequestWithDetails, action: "approve" | "reject" | "return") => {
    setReviewDialog({ open: true, request, action });
    setAdminNotes(request.admin_notes || "");
  };

  const confirmReview = () => {
    if (!reviewDialog.request || !reviewDialog.action) return;
    
    const statusMap: Record<string, LeaveStatus> = {
      approve: "approved",
      reject: "rejected",
      return: "pending",
    };

    reviewMutation.mutate({
      requestId: reviewDialog.request.id,
      status: statusMap[reviewDialog.action],
      notes: adminNotes,
    });
  };

  const filteredRequests = leaveRequests.filter(request => {
    const searchLower = searchTerm.toLowerCase();
    return (
      request.employee?.full_name?.toLowerCase().includes(searchLower) ||
      request.employee?.staff_id?.toLowerCase().includes(searchLower) ||
      request.department?.name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      case "returned":
        return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Returned</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: LeaveType) => {
    const styles: Record<string, string> = {
      annual: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      sick: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      emergency: "bg-red-500/10 text-red-600 border-red-500/20",
      maternity: "bg-pink-500/10 text-pink-600 border-pink-500/20",
      paternity: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
      unpaid: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      other: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      compassionate: "bg-amber-500/10 text-amber-700 border-amber-500/20",
      study: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    };
    return <Badge className={styles[type] || styles.other}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
  };

  const getDaysCount = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  if (!isHead && !isAdmin && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              You don't have permission to access leave administration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Administration</h1>
        <p className="text-muted-foreground">
          Review and manage staff leave requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {leaveRequests.filter(r => r.status === "pending").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {leaveRequests.filter(r => r.status === "approved").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Rejected</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {leaveRequests.filter(r => r.status === "rejected").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Requests</span>
            </div>
            <p className="text-2xl font-bold mt-1">{leaveRequests.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, staff ID, or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeaveStatus | "all")}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>
            {filteredRequests.length} request{filteredRequests.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No leave requests found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.employee?.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.employee?.staff_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.department?.code}</Badge>
                      </TableCell>
                      <TableCell>{getLeaveTypeBadge(request.leave_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(request.start_date), "dd MMM")} - {format(new Date(request.end_date), "dd MMM yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getDaysCount(request.start_date, request.end_date)}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {request.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleReview(request, "approve")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleReview(request, "reject")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(request, "return")}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Return
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false, request: null, action: null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === "approve" && "Approve Leave Request"}
              {reviewDialog.action === "reject" && "Reject Leave Request"}
              {reviewDialog.action === "return" && "Return to Pending"}
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.request && (
                <span>
                  {reviewDialog.request.employee?.full_name} - {reviewDialog.request.leave_type} leave
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.request && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Dates</Label>
                  <p className="text-sm font-medium">
                    {format(new Date(reviewDialog.request.start_date), "dd MMM")} - {format(new Date(reviewDialog.request.end_date), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <p className="text-sm font-medium">
                    {getDaysCount(reviewDialog.request.start_date, reviewDialog.request.end_date)} days
                  </p>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <p className="text-sm">{reviewDialog.request.reason || "No reason provided"}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add any notes for the employee..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialog({ open: false, request: null, action: null })}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReview}
              disabled={reviewMutation.isPending}
              className={
                reviewDialog.action === "approve" ? "bg-green-600 hover:bg-green-700" :
                reviewDialog.action === "reject" ? "bg-red-600 hover:bg-red-700" :
                ""
              }
            >
              {reviewMutation.isPending ? "Processing..." : 
               reviewDialog.action === "approve" ? "Approve" :
               reviewDialog.action === "reject" ? "Reject" :
               "Return to Pending"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveAdmin;
