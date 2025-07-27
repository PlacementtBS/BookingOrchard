// db.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// initialize Supabase client
const SUPABASE_URL = 'https://jkvthdkqqckhipdlnpuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdnRoZGtxcWNraGlwZGxucHVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MTU2NTQsImV4cCI6MjA2NzQ5MTY1NH0.jQHWBy-jKpocqiRcgb3caYicjJPa-3tCpWkVdK7Y3Wg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Insert data into a table
 * @param {string} table - table name
 * @param {object|array} data - row or array of rows to insert
 */
export async function insert(table, data) {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data);

  if (error) throw error;
  return result;
}

/**
 * Select data from a table
 * @param {string} table - table name
 * @param {string} [columns='*'] - columns to select
 * @param {object} [filter] - optional filter object: { column, operator, value }
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
 * Update data in a table
 * @param {string} table - table name
 * @param {object} values - column-value pairs to update
 * @param {object} filter - filter object: { column, operator, value }
 */
export async function update(table, values, filter) {
  let query = supabase.from(table).update(values);

  if (!filter) throw new Error('Update requires a filter.');

  query = query.filter(filter.column, filter.operator, filter.value);

  const { data: result, error } = await query;

  if (error) throw error;
  return result;
}

/**
 * Delete rows from a table
 * @param {string} table - table name
 * @param {object} filter - filter object: { column, operator, value }
 */
export async function remove(table, filter) {
  let query = supabase.from(table).delete();

  if (!filter) throw new Error('Delete requires a filter.');

  query = query.filter(filter.column, filter.operator, filter.value);

  const { data: result, error } = await query;

  if (error) throw error;
  return result;
}
