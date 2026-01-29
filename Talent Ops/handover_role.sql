-- Function to enable atomic role handover
create or replace function handover_project_role(
    project_id_input uuid,
    target_user_id_input uuid
)
returns void
language plpgsql
security definer
as $$
declare
    current_user_role text;
    caller_id uuid;
begin
    caller_id := auth.uid();

    -- 1. Check if the caller is a 'project_manager' or 'team_lead' for this project
    select role into current_user_role
    from project_members
    where project_id = project_id_input
    and user_id = caller_id;

    if current_user_role is null then
        raise exception 'You are not a member of this project';
    end if;

    if current_user_role not in ('project_manager', 'team_lead', 'manager') then
        raise exception 'Only Project Managers or Team Leads can handover their role';
    end if;

    -- 2. Update the target user's role to the caller's role
    update project_members
    set role = current_user_role
    where project_id = project_id_input
    and user_id = target_user_id_input;

    if not found then
        raise exception 'Target user is not a member of this project';
    end if;

    -- 3. Downgrade the caller's role to 'employee' (or 'consultant' if preferred default)
    update project_members
    set role = 'employee'
    where project_id = project_id_input
    and user_id = caller_id;
    
    -- Sync with team_members table (if it exists and is used)
    -- Best effort update for target user
    update team_members
    set role_in_project = current_user_role
    where team_id = project_id_input
    and profile_id = target_user_id_input;

    -- Best effort update for caller
    update team_members
    set role_in_project = 'employee'
    where team_id = project_id_input
    and profile_id = caller_id;

end;
$$;
