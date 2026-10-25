"""Small, answer-free learning hints. Never expose the evaluator's private explanation."""
import re
import unicodedata
from services.learning_language import learning_locale

def compact(value):
    return re.sub(r'\s+','',unicodedata.normalize('NFKC',str(value))).casefold()

def fallback_hint(snapshot,status,*,assisted=False):
    zh=learning_locale.get()!='en'
    if status=='correct':
        return ('改对了，继续下一题吧。' if assisted else '这次答对了，继续下一题吧。') if zh else 'Correct. Continue when you are ready.'
    if status=='invalid_question':
        return '这道题的条件或参考内容可能有问题，可以先跳过，我不会据此判你答错。' if zh else 'This question may have a problem. You can skip it without a wrong mark.'
    if status=='needs_clarification':
        return '这一步还不太清楚。可以补充你当前的计算步骤或思路，我再帮你看。' if zh else 'Please add the step or reasoning you used so I can help.'
    question=snapshot.get('question','')
    prefix=('这里还没完全对。' if status=='partial' else '这个答案还不对。') if zh else 'Not quite yet. '
    if '%02d' in question:
        hint='先区分“数值本身”和“显示格式”，留意格式串里的宽度与补零标记。' if zh else 'Separate the stored value from its display format; inspect width and padding flags.'
    elif '%' in question and '/' in question:
        hint='先算括号里的取余，再处理外面的除法；检查自己有没有停在中间步骤。' if zh else 'Work out the remainder inside the parentheses, then apply the outer division. Did you stop at an intermediate step?'
    elif snapshot.get('question_type')=='coding':
        hint='先对照题目要求，检查关键运算、返回值或输出是否齐全；改好后再提交。' if zh else 'Check the key operation and the required return value or output, then try again.'
    else:
        hint='先看清题目要求，再核对你使用的条件或运算步骤，改好后再试一次。' if zh else 'Check what the question asks and the conditions or steps you used, then try again.'
    return prefix+hint

def safe_hint(text,snapshot):
    """Reject explicit answer labels, final values, code solutions, and replacement tasks."""
    if not isinstance(text,str) or not text.strip() or len(text)>260:
        return False
    if '```' in text or re.search(r'(?:正确答案|答案是|应该选|应选|选项|选择|选)\s*[:：]?\s*[A-Za-z](?![A-Za-z0-9_])',text,re.I):
        return False
    if re.search(r'\b(?:answer\s+is|choose|option)\s*[:：]?\s*[A-Za-z](?![A-Za-z0-9_])',text,re.I):
        return False
    if re.search(r'(?:换一道|换成|再做一道|若把|如果把|再来一道|new question|another problem)',text,re.I):
        return False
    if re.search(r'\b\w+\s*=(?!=)',text):
        return False
    reference=str(snapshot.get('correct_answer') or '')
    options=snapshot.get('options') or {}
    gold=next((str(v) for k,v in options.items() if compact(k)==compact(reference)),reference)
    normalized=compact(text)
    if gold and len(compact(gold))>=2 and compact(gold) in normalized:
        return False
    for number in set(re.findall(r'(?<![\w.])-?\d+(?:\.\d+)?',gold)):
        if re.search(r'(?<![0-9A-Za-z_.])'+re.escape(number)+r'(?![0-9A-Za-z_.])',text):
            return False
    return True

def teaching_hint(snapshot,answer,assessment,*,assisted=False):
    status=assessment['status']
    if status=='correct' or status in ('needs_clarification','invalid_question'):
        return fallback_hint(snapshot,status,assisted=assisted)
    candidate=assessment.get('hint','')
    if safe_hint(candidate,snapshot):
        return candidate.strip()
    return fallback_hint(snapshot,status,assisted=assisted)


async def add_choice_hint(snapshot,answer,assessment):
    """An optional tutor hint never changes the deterministic choice verdict."""
    if assessment['status'] not in ('incorrect','partial'):
        return assessment
    question=snapshot.get('question','')
    if '%02d' in question or ('%' in question and '/' in question):
        return assessment  # Stable local hints for common formatting and integer-arithmetic tasks.
    from pydantic import BaseModel, Field
    from services.diagnosis.evidence_grader import model_json
    from libs.exceptions import LLMUnavailableError
    class HintOnly(BaseModel):
        hint: str = Field(min_length=1,max_length=260)
    options=snapshot.get('options') or {}
    selected=next((v for k,v in options.items() if compact(k)==compact(answer)),answer)
    try:
        output=await model_json('对错已经由程序核对，不重新判题。针对学生选择指出一个最可能的错误点并给一个小提示。'
            '只讨论原题。不能说正确选项、最终结果、完整解法；不换题，不问无关条件。',
            {'question':snapshot,'selected_label':answer,'selected_content':selected,
             'known_status':assessment['status']},HintOnly)
        if safe_hint(output.hint,snapshot):
            return {**assessment,'hint':output.hint}
    except LLMUnavailableError:
        pass
    return assessment
