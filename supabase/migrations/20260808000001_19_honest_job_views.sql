-- Job views are counted whether or not a Tracked link brought the visitor, so the index that
-- finds a browser's recent views of a Job has to find the linkless ones too.
--
-- The old index was partial (`where tracked_link_id is not null`) because one question was ever
-- asked of it: which link brought this session here, for attributing an Application. Recording a
-- view now asks a second one first — has this browser already been counted for this Job through
-- this attribution — and a Direct view is invisible to an index that excludes it.
--
-- Replaced rather than added beside: this table takes a row per view, and a second index on the
-- same leading columns would cost every one of those writes to answer what this one answers.
-- `tracked_link_id` sits third so the two questions share the (session, job) prefix.
drop index job_view_events_session_job_idx;

create index job_view_events_session_job_idx
  on job_view_events (session_id, job_id, tracked_link_id, viewed_at desc);
