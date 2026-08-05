# Total experience is derived once, stored, and read everywhere after

Total experience is computed from a Candidate's experience entries when they save their
profile, stored on `candidates`, copied onto a Snapshot when they apply, and thereafter only
ever read. Screening no longer aggregates anything: it compares one stored number to the
Job's minimum. The rule itself is unchanged and still lives in one place — overlapping jobs
merge, so two at once is one year a year — but it now runs at one moment instead of at every
judgement. Rejected: computing it at query time, which would put a second implementation of
the overlap merge into SQL that must agree with the Python one forever; and storing an
accrual anchor so a current job keeps counting after the last save, which is exact but
answers a question we decided is not ours — keeping a profile current is the Candidate's
job, and the number means "as they last saved it" deliberately.

Two consequences worth stating, both accepted on purpose. Experience is rounded to whole
years with six months rounding up, which *loosens* Screening: 31 months of work now clears a
three-year bar where it was previously refused. And dates become mandatory on an experience
entry — a start year always, an end year unless the job is current — which is what makes a
single number sufficient. Before this, Screening distinguished "short of the bar" from
"short of the bar only because we could not date some of it" and sent the second to a human
as `review_required`; with dates required that case cannot arise, so the distinction goes
and a lone number loses nothing. Requiring the dates is therefore load-bearing, not tidying:
without it, storing only a total would silently convert those referrals into rejections.
