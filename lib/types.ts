export type TicketStatus = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export type Ticket = {
  id: string;
  ticket_number: string;
  public_token: string;
  reporter_name: string;
  reporter_email: string | null;
  contact_number: string | null;
  department: string;
  location: string;
  category: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: TicketStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  accepted_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  updated_at: string;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_type: 'EMPLOYEE' | 'MIS';
  sender_name: string;
  sender_email: string | null;
  message: string;
  created_at: string;
};
