// db.js

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase client
const SUPABASE_URL = 'https://jkvthdkqqckhipdlnpuk.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdnRoZGtxcWNraGlwZGxucHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTU2NTQsImV4cCI6MjA2NzQ5MTY1NH0.jQHWBy-jKpocqiRcgb3caYicjJPa-3tCpWkVdK7Y3Wg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Insert data into a table
 * @param {string} table - Table name
 * @param {object|array} data - Row or array of rows to insert
 * @returns {Promise<object|array>} - Inserted data
 */
export async function insert(table, data) {
  const { data: result, error } = await supabase.from(table).insert(data);
  if (error) throw error;
  return result;
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
