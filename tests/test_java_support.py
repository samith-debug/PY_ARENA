import pytest
from backend.core.parser import parse_csv_content
from backend.core.java_sandbox import execute_java_sandboxed
from backend.core.sandbox import execute_code_sandboxed
from backend.core.test_runner import run_tests_for_question
from backend.models.schema import Question, TestCase

def test_java_sandbox_execution():
    code = """
import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a * b);
    }
}
"""
    result = execute_java_sandboxed(code=code, stdin_data="6 7\n")
    assert result.exit_code == 0
    assert result.stdout.strip() == "42"
    assert not result.timed_out
    assert result.error_message is None

def test_java_sandbox_auto_detect_class():
    code = """
public class Multiplier {
    public static void main(String[] args) {
        System.out.println("Computed Multiplier");
    }
}
"""
    result = execute_java_sandboxed(code=code)
    assert result.exit_code == 0
    assert result.stdout.strip() == "Computed Multiplier"

def test_java_sandbox_compilation_error():
    code = """
public class Broken {
    public static void main(String[] args) {
        System.out.println("Missing semicolon")
    }
}
"""
    result = execute_java_sandboxed(code=code)
    assert result.exit_code != 0
    assert result.error_message == "Compilation Error"
    assert "error:" in result.stderr

def test_java_sandbox_via_generic_runner():
    code = """
public class HelloJava {
    public static void main(String[] args) {
        System.out.println("Hello from generic runner");
    }
}
"""
    result = execute_code_sandboxed(code=code, language="java")
    assert result.exit_code == 0
    assert result.stdout.strip() == "Hello from generic runner"

def test_java_csv_parsing():
    csv_data = '''question_id,title,difficulty,problem_statement,language,starter_code,reference_solution,test_cases
JAVA-01,Sum Two Numbers,Easy,Read two numbers and print their sum.,java,"","public class Solution { public static void main(String[] args) { java.util.Scanner sc = new java.util.Scanner(System.in); System.out.println(sc.nextInt() + sc.nextInt()); } }","[{""input"": ""10 20\\n"", ""output"": ""30\\n"", ""is_hidden"": false}]"
'''
    bank = parse_csv_content(csv_data, "java_module_01.csv")
    assert bank.language == "java"
    assert len(bank.questions) == 1
    q = bank.questions[0]
    assert q.language == "java"
    assert "Scanner sc" in q.starter_code
    assert len(q.test_cases) == 1

def test_java_test_runner():
    q = Question(
        question_id="J1",
        title="Double Int",
        problem_statement="Multiply input integer by 2",
        language="java",
        test_cases=[
            TestCase(index=1, input="5\n", output="10\n", is_hidden=False),
            TestCase(index=2, input="12\n", output="24\n", is_hidden=False)
        ]
    )
    correct_code = """
import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(n * 2);
    }
}
"""
    res = run_tests_for_question(question=q, code=correct_code, bank_id="test", language="java")
    assert res.all_passed
    assert res.passed_tests == 2
    assert res.failed_tests == 0
