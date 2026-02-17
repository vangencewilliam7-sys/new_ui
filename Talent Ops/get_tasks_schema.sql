CREATE OR REPLACE FUNCTION get_table_schema(table_name_param text)
RETURNS TABLE (
    column_name text,
    data_type text,
    udt_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::text,
        c.data_type::text,
        c.udt_name::text
    FROM 
        information_schema.columns c
    WHERE 
        c.table_name = table_name_param;
END;
$$ LANGUAGE plpgsql;
