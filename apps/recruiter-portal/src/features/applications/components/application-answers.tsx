import { type AnsweredQuestion, answerText } from '../review';
import { ReviewCard } from './review-card';

export function ApplicationAnswers({ answers }: { answers: AnsweredQuestion[] }) {
  return (
    <ReviewCard title="Answers">
      {answers.length === 0 ? (
        <p className="text-dense text-muted-foreground">This Job asked no questions.</p>
      ) : (
        <dl className="space-y-5">
          {answers.map((answer) => (
            <div key={answer.question_id} className="space-y-1">
              <dt className="text-dense text-muted-foreground">{answer.question_text}</dt>
              <dd className="max-w-prose text-dense whitespace-pre-line text-foreground">
                {answerText(answer)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </ReviewCard>
  );
}
