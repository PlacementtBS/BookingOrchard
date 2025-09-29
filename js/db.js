// db.js
import { supabase } from './supabaseUpload.js';

/**
 * Insert data into a table
 * @param {string} table - Table name
 * @param {object|array} data - Row or array of rows to insert
 * @returns {Promise<object|array>} - Inserted data
 */
export async function insert(table, values) {
  const { data, error } = await supabase
    .from(table)
    .insert(values)
    .select()      // fetch the inserted rows back
    .single();     // get one row as object

  if (error) {
    console.error("Insert error:", error);
    throw error;
  }

  return data;  // data contains the inserted row with id
}


/**
 * Select data from a table
 * @param {string} table - Table name
 * @param {string} [columns='*'] - Columns to select
 * @param {object} [filter] - Optional filter: { column, operator, value }
 * @returns {Promise<array>} - Selected rows
 */
export async function select(table, columns = '*', filter) {
  let query = supabase.from(table).select(columns);
  if (filter) {
    query = query.filter(filter.column, filter.operator, filter.value);
  }
  const { data: result, error } = await query;
  if (error) throw error;
  return result;
}

/**
 * Update rows in a table
 * @param {string} table - Table name
 * @param {object} values - Key-value pairs of columns to update
 * @param {object} filter - Required filter: { column, operator, value }
 * @returns {Promise<array>} - Updated rows
 */
export async function update(table, values, filter) {
  if (!filter) throw new Error('Update requires a filter.');
  const { data: result, error } = await supabase
    .from(table)
    .update(values)
    .filter(filter.column, filter.operator, filter.value);
  if (error) throw error;
  return result;
}

/**
 * Delete rows from a table
 * @param {string} table - Table name
 * @param {object} filter - Required filter: { column, operator, value }
 * @returns {Promise<array>} - Deleted rows
 */
export async function remove(table, filter) {
  if (!filter) throw new Error('Delete requires a filter.');
  const { data: result, error } = await supabase
    .from(table)
    .delete()
    .filter(filter.column, filter.operator, filter.value);
  if (error) throw error;
  return result;
}
